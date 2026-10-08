//! Character sets a rail can carry (Section 40C.4 layer 2). A value outside the set is
//! refused with the offending character named; it is never transliterated silently.

/// The sets profiles may name.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Charset {
    /// EPC SEPA basic Latin: `a-z A-Z 0-9 / - ? : ( ) . , ' +` and space.
    EpcLatin,
    /// SWIFT `x` set: the EPC set (the two are the same characters on a single line).
    SwiftX,
    /// Printable ASCII (space to tilde).
    PrintableAscii,
}

impl Charset {
    pub fn from_name(name: &str) -> Option<Charset> {
        Some(match name {
            "epc-latin" => Charset::EpcLatin,
            "swift-x" => Charset::SwiftX,
            "printable-ascii" => Charset::PrintableAscii,
            _ => return None,
        })
    }

    pub fn allows(self, c: char) -> bool {
        match self {
            Charset::EpcLatin | Charset::SwiftX => {
                c.is_ascii_alphanumeric() || "/-?:().,'+ ".contains(c)
            }
            Charset::PrintableAscii => (' '..='~').contains(&c),
        }
    }

    /// The first character the set cannot carry.
    pub fn first_violation(self, text: &str) -> Option<char> {
        text.chars().find(|c| !self.allows(*c))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epc_latin_refuses_diacritics_and_symbols() {
        let epc = Charset::EpcLatin;
        assert_eq!(
            epc.first_violation("Invoice 2026/10-A (part 1), ref: x+y?"),
            None
        );
        assert_eq!(epc.first_violation("Łukasz"), Some('Ł'));
        assert_eq!(epc.first_violation("a&b"), Some('&'));
        assert_eq!(Charset::PrintableAscii.first_violation("a&b"), None);
        assert_eq!(Charset::PrintableAscii.first_violation("café"), Some('é'));
    }
}
