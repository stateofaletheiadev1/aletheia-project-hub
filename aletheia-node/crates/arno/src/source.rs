//! Source files and positions.

/// Byte offsets into one source file, `start..end`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    pub const fn new(start: usize, end: usize) -> Span {
        Span { start, end }
    }

    /// The smallest span covering both.
    pub fn to(self, other: Span) -> Span {
        Span {
            start: self.start.min(other.start),
            end: self.end.max(other.end),
        }
    }
}

/// A validated UTF-8 source with a line index.
#[derive(Debug, Clone)]
pub struct SourceFile {
    name: String,
    text: String,
    /// Byte offset of the start of each line.
    line_starts: Vec<usize>,
}

impl SourceFile {
    pub fn new(name: impl Into<String>, text: impl Into<String>) -> SourceFile {
        let text = text.into();
        let mut line_starts = vec![0];
        line_starts.extend(
            text.char_indices()
                .filter(|(_, c)| *c == '\n')
                .map(|(i, _)| i.saturating_add(1)),
        );
        SourceFile {
            name: name.into(),
            text,
            line_starts,
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn text(&self) -> &str {
        &self.text
    }

    /// 1-based line and column; the column counts characters, not bytes.
    pub fn line_column(&self, offset: usize) -> (usize, usize) {
        let line = self
            .line_starts
            .partition_point(|&start| start <= offset)
            .max(1);
        let start = self
            .line_starts
            .get(line.saturating_sub(1))
            .copied()
            .unwrap_or(0);
        let column = self
            .text
            .get(start..offset.min(self.text.len()))
            .map_or(0, |prefix| prefix.chars().count());
        (line, column.saturating_add(1))
    }

    /// 1-based line of a byte offset.
    pub fn line(&self, offset: usize) -> usize {
        self.line_column(offset).0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lines_and_columns_are_one_based_and_count_characters() {
        let file = SourceFile::new("a.arno", "ab\ncé d\n");
        assert_eq!(file.line_column(0), (1, 1));
        assert_eq!(file.line_column(1), (1, 2));
        assert_eq!(file.line_column(3), (2, 1));
        // 'é' is two bytes; 'd' is the fourth character of line 2.
        assert_eq!(file.line_column(7), (2, 4));
    }
}
