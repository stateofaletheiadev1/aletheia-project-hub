//! The hardened XML reader for validation layer 1 (Section 40C.4): at most 1 MiB, UTF-8, no
//! DTD, no entities beyond the five XML predefines and character references, no processing
//! instructions, bounded depth and element count. The result is a small tree of local names;
//! nothing here fetches, expands or resolves anything external.

use quick_xml::events::Event;
use quick_xml::reader::Reader;

use crate::layers::RailRejection;

/// Largest message accepted, checked before parsing.
pub const MAX_MESSAGE_BYTES: usize = 1 << 20;
const MAX_DEPTH: usize = 32;
const MAX_ELEMENTS: usize = 20_000;

fn reject(detail: impl Into<String>) -> RailRejection {
    RailRejection {
        layer: 1,
        reason: "FF01",
        field: "Document",
        detail: detail.into(),
    }
}

/// One element: its local name (prefix dropped), attributes, children and text.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Element {
    pub name: String,
    pub attrs: Vec<(String, String)>,
    pub children: Vec<Element>,
    pub text: String,
}

impl Element {
    pub fn new(name: &str) -> Element {
        Element {
            name: name.to_owned(),
            ..Element::default()
        }
    }

    pub fn child(&self, name: &str) -> Option<&Element> {
        self.children.iter().find(|c| c.name == name)
    }

    pub fn children_named<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a Element> + 'a {
        self.children.iter().filter(move |c| c.name == name)
    }

    /// The element at a `/`-separated path of local names below this one.
    pub fn at(&self, path: &str) -> Option<&Element> {
        path.split('/')
            .try_fold(self, |node, step| node.child(step))
    }

    /// The text at `path`, trimmed.
    pub fn text_at(&self, path: &str) -> Option<&str> {
        self.at(path).map(|e| e.text.trim())
    }

    pub fn attr(&self, name: &str) -> Option<&str> {
        self.attrs
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
    }
}

fn local(name: &[u8]) -> Result<String, RailRejection> {
    let text = core::str::from_utf8(name).map_err(|_| reject("an element name is not UTF-8"))?;
    Ok(text.rsplit(':').next().unwrap_or(text).to_owned())
}

fn element(start: &quick_xml::events::BytesStart<'_>) -> Result<Element, RailRejection> {
    let mut out = Element::new(&local(start.name().as_ref())?);
    for attr in start.attributes() {
        let attr = attr.map_err(|e| reject(format!("a malformed attribute: {e}")))?;
        let key = core::str::from_utf8(attr.key.as_ref())
            .map_err(|_| reject("an attribute name is not UTF-8"))?
            .to_owned();
        // Resolves only the five predefined entities and character references.
        let value = attr
            .unescape_value()
            .map_err(|e| reject(format!("attribute {key}: {e}")))?
            .into_owned();
        out.attrs.push((key, value));
    }
    Ok(out)
}

/// Parses one document into its root element.
pub fn parse(bytes: &[u8]) -> Result<Element, RailRejection> {
    if bytes.len() > MAX_MESSAGE_BYTES {
        return Err(reject(format!(
            "the message is {} bytes; at most {MAX_MESSAGE_BYTES} are accepted",
            bytes.len()
        )));
    }
    let text = core::str::from_utf8(bytes).map_err(|_| reject("the message is not UTF-8"))?;
    let mut reader = Reader::from_str(text);
    reader.config_mut().check_end_names = true;

    let mut stack: Vec<Element> = Vec::new();
    let mut root: Option<Element> = None;
    let mut count = 0usize;
    let mut seen_content = false;
    loop {
        let event = reader
            .read_event()
            .map_err(|e| reject(format!("the message is not well-formed XML: {e}")))?;
        match event {
            Event::Decl(decl) => {
                if seen_content {
                    return Err(reject("the XML declaration must come first"));
                }
                if let Some(encoding) = decl.encoding() {
                    let encoding = encoding.map_err(|e| reject(e.to_string()))?;
                    if !encoding.eq_ignore_ascii_case(b"utf-8") {
                        return Err(reject("only UTF-8 messages are accepted"));
                    }
                }
            }
            Event::DocType(_) => return Err(reject("a DTD is not allowed")),
            Event::PI(_) => return Err(reject("processing instructions are not allowed")),
            Event::Comment(_) => {}
            Event::Start(start) => {
                seen_content = true;
                if root.is_some() {
                    return Err(reject("the message has more than one root element"));
                }
                count = count.saturating_add(1);
                if count > MAX_ELEMENTS || stack.len() >= MAX_DEPTH {
                    return Err(reject(
                        "the message is nested too deeply or has too many elements",
                    ));
                }
                stack.push(element(&start)?);
            }
            Event::Empty(start) => {
                seen_content = true;
                if root.is_some() {
                    return Err(reject("the message has more than one root element"));
                }
                count = count.saturating_add(1);
                if count > MAX_ELEMENTS {
                    return Err(reject("the message has too many elements"));
                }
                let node = element(&start)?;
                match stack.last_mut() {
                    Some(parent) => parent.children.push(node),
                    None => root = Some(node),
                }
            }
            Event::End(_) => {
                let node = stack
                    .pop()
                    .ok_or_else(|| reject("an end tag without a start"))?;
                match stack.last_mut() {
                    Some(parent) => parent.children.push(node),
                    None => root = Some(node),
                }
            }
            Event::Text(t) => {
                let value = t.decode().map_err(|e| reject(e.to_string()))?;
                match stack.last_mut() {
                    Some(node) => node.text.push_str(&value),
                    None if value.trim().is_empty() => {}
                    None => return Err(reject("text outside the root element")),
                }
            }
            Event::CData(c) => {
                let value = c.decode().map_err(|e| reject(e.to_string()))?;
                match stack.last_mut() {
                    Some(node) => node.text.push_str(&value),
                    None => return Err(reject("text outside the root element")),
                }
            }
            Event::GeneralRef(r) => {
                let resolved = match r.resolve_char_ref().map_err(|e| reject(e.to_string()))? {
                    Some(c) => c,
                    None => match r.decode().map_err(|e| reject(e.to_string()))?.as_ref() {
                        "lt" => '<',
                        "gt" => '>',
                        "amp" => '&',
                        "apos" => '\'',
                        "quot" => '"',
                        other => {
                            return Err(reject(format!(
                                "entity references are not allowed (&{other};)"
                            )));
                        }
                    },
                };
                match stack.last_mut() {
                    Some(node) => node.text.push(resolved),
                    None => return Err(reject("text outside the root element")),
                }
            }
            Event::Eof => break,
        }
    }
    if !stack.is_empty() {
        return Err(reject("the message ends inside an element"));
    }
    root.ok_or_else(|| reject("the message has no root element"))
}

/// Escapes text and attribute values for output.
pub fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            other => out.push(other),
        }
    }
    out
}

/// A deterministic writer: two-space indentation, elements in the order written.
#[derive(Debug, Default)]
pub struct Writer {
    out: String,
    open: Vec<&'static str>,
}

impl Writer {
    pub fn new() -> Writer {
        Writer {
            out: String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"),
            open: Vec::new(),
        }
    }

    fn indent(&mut self) {
        for _ in 0..self.open.len() {
            self.out.push_str("  ");
        }
    }

    pub fn open(&mut self, name: &'static str, attrs: &[(&str, &str)]) {
        self.indent();
        self.out.push('<');
        self.out.push_str(name);
        for (key, value) in attrs {
            self.out.push_str(&format!(" {key}=\"{}\"", escape(value)));
        }
        self.out.push_str(">\n");
        self.open.push(name);
    }

    pub fn close(&mut self) {
        if let Some(name) = self.open.pop() {
            self.indent();
            self.out.push_str(&format!("</{name}>\n"));
        }
    }

    pub fn leaf(&mut self, name: &'static str, attrs: &[(&str, &str)], text: &str) {
        self.indent();
        self.out.push('<');
        self.out.push_str(name);
        for (key, value) in attrs {
            self.out.push_str(&format!(" {key}=\"{}\"", escape(value)));
        }
        self.out.push_str(&format!(">{}</{name}>\n", escape(text)));
    }

    pub fn finish(mut self) -> String {
        while !self.open.is_empty() {
            self.close();
        }
        self.out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_plain_document_parses_into_local_names() {
        let doc = parse(
            br#"<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:x"><A><B c="1 &amp; 2">x &lt; y &#x41;</B></A><E/></Document>"#,
        )
        .unwrap();
        assert_eq!(doc.name, "Document");
        assert_eq!(doc.attr("xmlns"), Some("urn:x"));
        let b = doc.at("A/B").unwrap();
        assert_eq!(b.text, "x < y A");
        assert_eq!(b.attr("c"), Some("1 & 2"));
        assert!(doc.child("E").is_some());
    }

    #[test]
    fn hostile_input_is_refused_before_content() {
        let refuse = |xml: &str, why: &str| {
            let error = parse(xml.as_bytes()).unwrap_err();
            assert_eq!((error.layer, error.reason), (1, "FF01"));
            assert!(error.detail.contains(why), "{xml}: {}", error.detail);
        };
        refuse(
            r#"<?xml version="1.0"?><!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]><d>&x;</d>"#,
            "DTD",
        );
        refuse("<d>&custom;</d>", "entity");
        refuse("<?php run ?><d/>", "processing");
        refuse("<a/><b/>", "more than one root");
        refuse("<a><b></a>", "well-formed");
        refuse("text<a/>", "outside");
        refuse(
            r#"<?xml version="1.0" encoding="ISO-8859-1"?><d/>"#,
            "UTF-8",
        );
        refuse(&"<a>".repeat(40), "deeply");
        let huge = format!("<d>{}</d>", "x".repeat(MAX_MESSAGE_BYTES));
        refuse(&huge, "bytes");
    }

    #[test]
    fn the_writer_escapes_and_round_trips() {
        let mut w = Writer::new();
        w.open("Document", &[("xmlns", "urn:x")]);
        w.leaf("Nm", &[], "Smith & <Sons>");
        let xml = w.finish();
        let doc = parse(xml.as_bytes()).unwrap();
        assert_eq!(doc.text_at("Nm"), Some("Smith & <Sons>"));
    }

    proptest::proptest! {
        /// Arbitrary bytes never panic the reader.
        #[test]
        fn any_bytes_parse_or_are_refused(bytes in proptest::collection::vec(proptest::num::u8::ANY, 0..512)) {
            let _ = parse(&bytes);
        }
    }
}
