//! ISO 20022 bounded text types. Length is counted in characters, as the ISO schemas count
//! it, and checked when the value is built: an over-long value is an error, never cut short.

use serde::{Deserialize, Serialize};

use crate::error::ModelError;

macro_rules! bounded_text {
    ($name:ident, $max:literal) => {
        #[doc = concat!("ISO 20022 `", stringify!($name), "`: 1 to ", stringify!($max), " characters.")]
        #[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
        #[serde(transparent)]
        pub struct $name(String);

        impl $name {
            pub const MAX_CHARS: usize = $max;

            pub fn new(value: impl Into<String>) -> Result<$name, ModelError> {
                let value = value.into();
                let chars = value.chars().count();
                if chars == 0 {
                    return Err(ModelError::new(stringify!($name), "the text is empty"));
                }
                if chars > $max {
                    return Err(ModelError::new(
                        stringify!($name),
                        format!("{chars} characters is more than the {} allowed", $max),
                    ));
                }
                Ok($name(value))
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(
                deserializer: D,
            ) -> Result<$name, D::Error> {
                let value = String::deserialize(deserializer)?;
                $name::new(value).map_err(serde::de::Error::custom)
            }
        }

        impl core::fmt::Display for $name {
            fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
                f.write_str(&self.0)
            }
        }
    };
}

bounded_text!(Max16Text, 16);
bounded_text!(Max35Text, 35);
bounded_text!(Max70Text, 70);
bounded_text!(Max140Text, 140);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn length_counts_characters_not_bytes() {
        // 35 characters, more than 35 bytes.
        let polish = "Ł".repeat(35);
        assert!(polish.len() > 35);
        assert!(Max35Text::new(polish).is_ok());
        assert!(Max35Text::new("Ł".repeat(36)).is_err());
        assert!(Max35Text::new("").is_err());
        assert_eq!(Max140Text::MAX_CHARS, 140);
    }
}
