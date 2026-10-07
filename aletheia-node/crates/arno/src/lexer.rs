//! The lexer (spec Section 26): hand-written, over validated UTF-8, with case-insensitive
//! keywords and `{ }` / `(* *)` comments.
//!
//! Words that are keywords only in one position (`each`, `at`, `most`, `times`, `max`, and
//! the effect words after `changes`, `receives`, ...) are ordinary identifiers here; the parser
//! recognises them where they belong, so they stay usable as names elsewhere.

use crate::diagnostics::Diagnostics;
use crate::source::Span;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Keyword {
    Contract,
    Version,
    Uses,
    Const,
    Type,
    Errors,
    Events,
    Storage,
    Constructor,
    Procedure,
    Function,
    Entry,
    View,
    Reentrant,
    Var,
    Begin,
    End,
    If,
    Then,
    Else,
    Case,
    Of,
    For,
    In,
    To,
    Do,
    While,
    Require,
    Otherwise,
    Fail,
    Emit,
    Move,
    Exit,
    And,
    Or,
    Not,
    Xor,
    Div,
    Mod,
    Record,
    Array,
    True,
    False,
}

impl Keyword {
    pub const ALL: [Keyword; 43] = [
        Keyword::Contract,
        Keyword::Version,
        Keyword::Uses,
        Keyword::Const,
        Keyword::Type,
        Keyword::Errors,
        Keyword::Events,
        Keyword::Storage,
        Keyword::Constructor,
        Keyword::Procedure,
        Keyword::Function,
        Keyword::Entry,
        Keyword::View,
        Keyword::Reentrant,
        Keyword::Var,
        Keyword::Begin,
        Keyword::End,
        Keyword::If,
        Keyword::Then,
        Keyword::Else,
        Keyword::Case,
        Keyword::Of,
        Keyword::For,
        Keyword::In,
        Keyword::To,
        Keyword::Do,
        Keyword::While,
        Keyword::Require,
        Keyword::Otherwise,
        Keyword::Fail,
        Keyword::Emit,
        Keyword::Move,
        Keyword::Exit,
        Keyword::And,
        Keyword::Or,
        Keyword::Not,
        Keyword::Xor,
        Keyword::Div,
        Keyword::Mod,
        Keyword::Record,
        Keyword::Array,
        Keyword::True,
        Keyword::False,
    ];

    /// Canonical (lowercase) spelling.
    pub const fn as_str(self) -> &'static str {
        match self {
            Keyword::Contract => "contract",
            Keyword::Version => "version",
            Keyword::Uses => "uses",
            Keyword::Const => "const",
            Keyword::Type => "type",
            Keyword::Errors => "errors",
            Keyword::Events => "events",
            Keyword::Storage => "storage",
            Keyword::Constructor => "constructor",
            Keyword::Procedure => "procedure",
            Keyword::Function => "function",
            Keyword::Entry => "entry",
            Keyword::View => "view",
            Keyword::Reentrant => "reentrant",
            Keyword::Var => "var",
            Keyword::Begin => "begin",
            Keyword::End => "end",
            Keyword::If => "if",
            Keyword::Then => "then",
            Keyword::Else => "else",
            Keyword::Case => "case",
            Keyword::Of => "of",
            Keyword::For => "for",
            Keyword::In => "in",
            Keyword::To => "to",
            Keyword::Do => "do",
            Keyword::While => "while",
            Keyword::Require => "require",
            Keyword::Otherwise => "otherwise",
            Keyword::Fail => "fail",
            Keyword::Emit => "emit",
            Keyword::Move => "move",
            Keyword::Exit => "exit",
            Keyword::And => "and",
            Keyword::Or => "or",
            Keyword::Not => "not",
            Keyword::Xor => "xor",
            Keyword::Div => "div",
            Keyword::Mod => "mod",
            Keyword::Record => "record",
            Keyword::Array => "array",
            Keyword::True => "true",
            Keyword::False => "false",
        }
    }

    pub fn from_word(word: &str) -> Option<Keyword> {
        Keyword::ALL
            .into_iter()
            .find(|keyword| keyword.as_str().eq_ignore_ascii_case(word))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TokenKind {
    Keyword(Keyword),
    /// As written; names compare case-insensitively.
    Ident(String),
    Int(u128),
    /// Contents with `''` already turned into `'`.
    Str(String),
    Assign,
    Eq,
    NotEq,
    Lt,
    LtEq,
    Gt,
    GtEq,
    Plus,
    Minus,
    Star,
    LParen,
    RParen,
    LBracket,
    RBracket,
    Comma,
    Semicolon,
    Colon,
    Dot,
    DotDot,
    Eof,
}

impl TokenKind {
    /// How the token reads in a message.
    pub fn describe(&self) -> String {
        match self {
            TokenKind::Keyword(keyword) => format!("'{}'", keyword.as_str()),
            TokenKind::Ident(name) => format!("'{name}'"),
            TokenKind::Int(value) => format!("the number {value}"),
            TokenKind::Str(_) => "a text literal".to_owned(),
            TokenKind::Eof => "the end of the file".to_owned(),
            other => format!("'{}'", other.symbol()),
        }
    }

    fn symbol(&self) -> &'static str {
        match self {
            TokenKind::Assign => ":=",
            TokenKind::Eq => "=",
            TokenKind::NotEq => "<>",
            TokenKind::Lt => "<",
            TokenKind::LtEq => "<=",
            TokenKind::Gt => ">",
            TokenKind::GtEq => ">=",
            TokenKind::Plus => "+",
            TokenKind::Minus => "-",
            TokenKind::Star => "*",
            TokenKind::LParen => "(",
            TokenKind::RParen => ")",
            TokenKind::LBracket => "[",
            TokenKind::RBracket => "]",
            TokenKind::Comma => ",",
            TokenKind::Semicolon => ";",
            TokenKind::Colon => ":",
            TokenKind::Dot => ".",
            TokenKind::DotDot => "..",
            _ => "?",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Token {
    pub kind: TokenKind,
    pub span: Span,
}

/// Longest text literal accepted (bounded text types are far smaller; this bounds memory).
pub const MAX_STRING_BYTES: usize = 64 * 1024;

struct Lexer<'a> {
    text: &'a str,
    position: usize,
    diagnostics: &'a mut Diagnostics,
}

impl Lexer<'_> {
    fn peek(&self) -> Option<char> {
        self.text.get(self.position..)?.chars().next()
    }

    fn peek_second(&self) -> Option<char> {
        let mut chars = self.text.get(self.position..)?.chars();
        chars.next();
        chars.next()
    }

    fn bump(&mut self) -> Option<char> {
        let c = self.peek()?;
        self.position = self.position.saturating_add(c.len_utf8());
        Some(c)
    }

    fn eat(&mut self, expected: char) -> bool {
        if self.peek() == Some(expected) {
            self.bump();
            true
        } else {
            false
        }
    }

    /// Skips whitespace and comments. Returns false at the end of input.
    fn skip_trivia(&mut self) {
        loop {
            match (self.peek(), self.peek_second()) {
                (Some(c), _) if c.is_whitespace() => {
                    self.bump();
                }
                (Some('{'), _) => {
                    let start = self.position;
                    self.bump();
                    loop {
                        match self.bump() {
                            Some('}') => break,
                            Some(_) => {}
                            None => {
                                self.diagnostics.error(
                                    "A1003",
                                    Span::new(start, start.saturating_add(1)),
                                    "This comment is never closed. Add '}' where it should end.",
                                );
                                return;
                            }
                        }
                    }
                }
                (Some('('), Some('*')) => {
                    let start = self.position;
                    self.bump();
                    self.bump();
                    loop {
                        match self.bump() {
                            Some('*') if self.peek() == Some(')') => {
                                self.bump();
                                break;
                            }
                            Some(_) => {}
                            None => {
                                self.diagnostics.error(
                                    "A1003",
                                    Span::new(start, start.saturating_add(2)),
                                    "This comment is never closed. Add '*)' where it should end.",
                                );
                                return;
                            }
                        }
                    }
                }
                _ => return,
            }
        }
    }

    fn word(&mut self, start: usize) -> TokenKind {
        while self
            .peek()
            .is_some_and(|c| c.is_ascii_alphanumeric() || c == '_')
        {
            self.bump();
        }
        let word = self.text.get(start..self.position).unwrap_or("");
        Keyword::from_word(word)
            .map_or_else(|| TokenKind::Ident(word.to_owned()), TokenKind::Keyword)
    }

    /// The first digit (at `start`) was already consumed by the caller.
    fn number(&mut self, start: usize) -> TokenKind {
        let mut value: Option<u128> = self
            .text
            .get(start..)
            .and_then(|rest| rest.chars().next())
            .and_then(|first| first.to_digit(10))
            .map(u128::from);
        while let Some(c) = self.peek() {
            if let Some(digit) = c.to_digit(10) {
                self.bump();
                value = value
                    .and_then(|v| v.checked_mul(10))
                    .and_then(|v| v.checked_add(u128::from(digit)));
            } else if c == '_' && self.peek_second().is_some_and(|n| n.is_ascii_digit()) {
                // Digit separators: 1_000_000.
                self.bump();
            } else {
                break;
            }
        }
        if self
            .peek()
            .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        {
            let bad_start = self.position;
            while self
                .peek()
                .is_some_and(|c| c.is_ascii_alphanumeric() || c == '_')
            {
                self.bump();
            }
            self.diagnostics.error(
                "A1006",
                Span::new(start, self.position.max(bad_start)),
                "A number cannot run straight into letters. Put a space or operator between them.",
            );
        }
        match value {
            Some(value) => TokenKind::Int(value),
            None => {
                self.diagnostics.error(
                    "A1004",
                    Span::new(start, self.position),
                    "This number is too large. The largest number Arno accepts is 2^128 - 1.",
                );
                TokenKind::Int(0)
            }
        }
    }

    fn string(&mut self, start: usize) -> TokenKind {
        let mut contents = String::new();
        loop {
            match self.bump() {
                Some('\'') if self.peek() == Some('\'') => {
                    self.bump();
                    contents.push('\'');
                }
                Some('\'') => break,
                Some('\n') | None => {
                    self.diagnostics.error(
                        "A1002",
                        Span::new(start, start.saturating_add(1)),
                        "This text is never closed. Add a closing quote (') on the same line.",
                    );
                    break;
                }
                Some(c) => contents.push(c),
            }
        }
        if contents.len() > MAX_STRING_BYTES {
            self.diagnostics.error(
                "A1007",
                Span::new(start, self.position),
                format!("This text is longer than {MAX_STRING_BYTES} bytes."),
            );
            contents.clear();
        }
        TokenKind::Str(contents)
    }

    fn next_token(&mut self) -> Token {
        loop {
            self.skip_trivia();
            let start = self.position;
            let Some(c) = self.bump() else {
                return Token {
                    kind: TokenKind::Eof,
                    span: Span::new(start, start),
                };
            };
            let kind = match c {
                c if c.is_ascii_alphabetic() || c == '_' => self.word(start),
                c if c.is_ascii_digit() => self.number(start),
                '\'' => self.string(start),
                ':' if self.eat('=') => TokenKind::Assign,
                ':' => TokenKind::Colon,
                '=' => TokenKind::Eq,
                '<' if self.eat('>') => TokenKind::NotEq,
                '<' if self.eat('=') => TokenKind::LtEq,
                '<' => TokenKind::Lt,
                '>' if self.eat('=') => TokenKind::GtEq,
                '>' => TokenKind::Gt,
                '+' => TokenKind::Plus,
                '-' => TokenKind::Minus,
                '*' => TokenKind::Star,
                '(' => TokenKind::LParen,
                ')' => TokenKind::RParen,
                '[' => TokenKind::LBracket,
                ']' => TokenKind::RBracket,
                ',' => TokenKind::Comma,
                ';' => TokenKind::Semicolon,
                '.' if self.eat('.') => TokenKind::DotDot,
                '.' => TokenKind::Dot,
                '/' => {
                    self.diagnostics.error(
                        "A1008",
                        Span::new(start, self.position),
                        "Arno has no '/' operator. Use 'div' for whole-number division, or MulDiv from Std.Math for money.",
                    );
                    continue;
                }
                other => {
                    self.diagnostics.error(
                        "A1001",
                        Span::new(start, self.position),
                        format!("The character '{other}' is not part of Arno."),
                    );
                    continue;
                }
            };
            return Token {
                kind,
                span: Span::new(start, self.position),
            };
        }
    }
}

/// Splits `text` into tokens, ending with `Eof`. Problems are reported and skipped, so the
/// parser always gets a usable stream.
pub fn lex(text: &str, diagnostics: &mut Diagnostics) -> Vec<Token> {
    let mut lexer = Lexer {
        text,
        position: 0,
        diagnostics,
    };
    let mut tokens = Vec::new();
    loop {
        let token = lexer.next_token();
        let end = token.kind == TokenKind::Eof;
        tokens.push(token);
        if end {
            return tokens;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(text: &str) -> (Vec<TokenKind>, Vec<&'static str>) {
        let mut diagnostics = Diagnostics::default();
        let tokens = lex(text, &mut diagnostics);
        (
            tokens.into_iter().map(|t| t.kind).collect(),
            diagnostics.iter().map(|d| d.code).collect(),
        )
    }

    #[test]
    fn keywords_are_case_insensitive_and_names_keep_their_spelling() {
        let (tokens, errors) = kinds("BEGIN Begin begin MyName");
        assert!(errors.is_empty());
        assert_eq!(
            tokens,
            vec![
                TokenKind::Keyword(Keyword::Begin),
                TokenKind::Keyword(Keyword::Begin),
                TokenKind::Keyword(Keyword::Begin),
                TokenKind::Ident("MyName".to_owned()),
                TokenKind::Eof
            ]
        );
    }

    #[test]
    fn operators_comments_and_literals() {
        let (tokens, errors) = kinds("X := 1_000 { brace } (* paren *) <> <= >= .. 'it''s'");
        assert!(errors.is_empty(), "{errors:?}");
        assert_eq!(
            tokens,
            vec![
                TokenKind::Ident("X".to_owned()),
                TokenKind::Assign,
                TokenKind::Int(1000),
                TokenKind::NotEq,
                TokenKind::LtEq,
                TokenKind::GtEq,
                TokenKind::DotDot,
                TokenKind::Str("it's".to_owned()),
                TokenKind::Eof
            ]
        );
    }

    #[test]
    fn version_numbers_lex_as_number_dot_number() {
        let (tokens, _) = kinds("0.1");
        assert_eq!(
            tokens,
            vec![
                TokenKind::Int(0),
                TokenKind::Dot,
                TokenKind::Int(1),
                TokenKind::Eof
            ]
        );
    }

    #[test]
    fn problems_are_reported_with_codes_and_skipped() {
        assert_eq!(kinds("{ never closed").1, vec!["A1003"]);
        assert_eq!(kinds("'open").1, vec!["A1002"]);
        assert_eq!(
            kinds("340282366920938463463374607431768211456").1,
            vec!["A1004"]
        );
        assert_eq!(kinds("A / B").1, vec!["A1008"]);
        assert_eq!(kinds("A # B").1, vec!["A1001"]);
        assert_eq!(kinds("12abc").1, vec!["A1006"]);
    }

    proptest::proptest! {
        /// The lexer never panics and always ends with `Eof`, whatever the input.
        #[test]
        fn any_text_lexes(text in "\\PC{0,200}") {
            let mut diagnostics = Diagnostics::default();
            let tokens = lex(&text, &mut diagnostics);
            proptest::prop_assert_eq!(tokens.last().map(|t| &t.kind), Some(&TokenKind::Eof));
        }
    }
}
