//! TLS 1.3 with mutual authentication (spec Section 36, ADR-016).
//!
//! Peers present self-signed transport certificates (ECDSA P-256). A node keeps its certificate
//! across restarts ([`TransportCertificate::load_or_create`], ADR-071), so the SHA-256 an operator
//! registers stays valid; rotation through the registry (Section 19.2) follows separately. Trust does not come from a CA: the verifiers below accept any certificate,
//! or for validators only the one whose SHA-256 is pinned in the validator registry, but
//! always check the TLS handshake signature, so a peer proves it holds its certificate's
//! key. Who the peer *is* is established by the signed application handshake that follows,
//! bound to this TLS session through exported keying material.

use std::sync::Arc;

use aletheia_core::{AletheiaError, ErrorCode, Hash32};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::{
    CryptoProvider, WebPkiSupportedAlgorithms, verify_tls12_signature, verify_tls13_signature,
};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer, ServerName, UnixTime};
use rustls::server::danger::{ClientCertVerified, ClientCertVerifier};
use rustls::{
    ClientConfig, DigitallySignedStruct, DistinguishedName, ServerConfig, SignatureScheme,
};
use sha2::{Digest, Sha256};

/// The name both sides use for SNI. Certificates are not checked against it.
pub const PEER_SERVER_NAME: &str = "aletheia-peer";

fn handshake_error(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::P2pHandshakeFailed, detail)
}

/// SHA-256 of a certificate's DER bytes: the `transport_cert_sha256` of Section 43 genesis
/// validator entries.
pub fn certificate_hash(der: &[u8]) -> Hash32 {
    Hash32::from_bytes(Sha256::digest(der).into())
}

/// A node's TLS certificate and key.
pub struct TransportCertificate {
    certificate: CertificateDer<'static>,
    key_pkcs8: Vec<u8>,
}

impl core::fmt::Debug for TransportCertificate {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(
            f,
            "TransportCertificate({})",
            certificate_hash(&self.certificate)
        )
    }
}

impl Drop for TransportCertificate {
    fn drop(&mut self) {
        self.key_pkcs8.iter_mut().for_each(|byte| *byte = 0);
    }
}

impl TransportCertificate {
    /// A fresh self-signed ECDSA P-256 certificate.
    pub fn generate() -> Result<TransportCertificate, AletheiaError> {
        let key = rcgen::KeyPair::generate().map_err(|e| {
            AletheiaError::new(
                ErrorCode::KeyGenerationFailed,
                format!("transport key: {e}"),
            )
        })?;
        let params =
            rcgen::CertificateParams::new(vec![PEER_SERVER_NAME.to_owned()]).map_err(|e| {
                AletheiaError::new(
                    ErrorCode::KeyGenerationFailed,
                    format!("transport certificate: {e}"),
                )
            })?;
        let certificate = params.self_signed(&key).map_err(|e| {
            AletheiaError::new(
                ErrorCode::KeyGenerationFailed,
                format!("transport certificate: {e}"),
            )
        })?;
        Ok(TransportCertificate {
            certificate: certificate.der().clone(),
            key_pkcs8: key.serialize_der(),
        })
    }

    /// The node's certificate from `dir` (`transport-cert.der`, `transport-key.pk8`), or a new
    /// one written there on first start (ADR-071). The key file is readable by its owner only.
    /// A pair that does not belong together is refused rather than replaced: replacing it would
    /// change the hash registered for this validator.
    ///
    /// A certificate prepared with [`TransportCertificate::prepare_next`] is put in place first,
    /// the old pair kept as `previous-transport-*` (ADR-074).
    pub fn load_or_create(dir: &std::path::Path) -> Result<TransportCertificate, AletheiaError> {
        let cert_path = dir.join(CERT_FILE);
        let key_path = dir.join(KEY_FILE);
        promote_next(dir)?;
        if cert_path.exists() || key_path.exists() {
            return read_pair(&cert_path, &key_path).map_err(|e| {
                AletheiaError::new(
                    e.code(),
                    format!(
                        "{}; restore both files of {} from backup",
                        e.detail(),
                        dir.display()
                    ),
                )
            });
        }
        let fresh = TransportCertificate::generate()?;
        std::fs::create_dir_all(dir).map_err(|e| io_failure("create", dir, &e))?;
        write_private(&key_path, &fresh.key_pkcs8)
            .map_err(|e| io_failure("write", &key_path, &e))?;
        std::fs::write(&cert_path, fresh.certificate.as_ref())
            .map_err(|e| io_failure("write", &cert_path, &e))?;
        Ok(fresh)
    }

    /// Writes a new certificate beside the current one (`next-transport-*`), used from the
    /// node's next start, and returns its hash to register with `RotateTransportCert`
    /// (ADR-074). Asked again before that start, it returns the same one.
    pub fn prepare_next(dir: &std::path::Path) -> Result<Hash32, AletheiaError> {
        let cert_path = dir.join(NEXT_CERT_FILE);
        let key_path = dir.join(NEXT_KEY_FILE);
        if cert_path.exists() && key_path.exists() {
            return read_pair(&cert_path, &key_path).map(|pair| pair.hash());
        }
        let fresh = TransportCertificate::generate()?;
        std::fs::create_dir_all(dir).map_err(|e| io_failure("create", dir, &e))?;
        // The key first: a crash then leaves a key alone, which is ignored and rewritten.
        write_private(&key_path, &fresh.key_pkcs8)
            .map_err(|e| io_failure("write", &key_path, &e))?;
        std::fs::write(&cert_path, fresh.certificate.as_ref())
            .map_err(|e| io_failure("write", &cert_path, &e))?;
        Ok(fresh.hash())
    }

    pub fn hash(&self) -> Hash32 {
        certificate_hash(&self.certificate)
    }

    fn chain(&self) -> Vec<CertificateDer<'static>> {
        vec![self.certificate.clone()]
    }

    fn key(&self) -> PrivateKeyDer<'static> {
        PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(self.key_pkcs8.clone()))
    }
}

const CERT_FILE: &str = "transport-cert.der";
const KEY_FILE: &str = "transport-key.pk8";
const NEXT_CERT_FILE: &str = "next-transport-cert.der";
const NEXT_KEY_FILE: &str = "next-transport-key.pk8";
const PREVIOUS_CERT_FILE: &str = "previous-transport-cert.der";
const PREVIOUS_KEY_FILE: &str = "previous-transport-key.pk8";

fn io_failure(action: &str, path: &std::path::Path, error: &std::io::Error) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoIo,
        format!("{action} {}: {error}", path.display()),
    )
}

/// A certificate and key read from disk, checked to belong together.
fn read_pair(
    cert_path: &std::path::Path,
    key_path: &std::path::Path,
) -> Result<TransportCertificate, AletheiaError> {
    let certificate = std::fs::read(cert_path).map_err(|e| io_failure("read", cert_path, &e))?;
    let key_pkcs8 = std::fs::read(key_path).map_err(|e| io_failure("read", key_path, &e))?;
    let loaded = TransportCertificate {
        certificate: CertificateDer::from(certificate),
        key_pkcs8,
    };
    // rustls checks the key matches the certificate.
    server_config(&loaded).map_err(|e| {
        AletheiaError::new(
            ErrorCode::StoCorrupt,
            format!(
                "the transport certificate {} does not match its key ({})",
                cert_path.display(),
                e.detail()
            ),
        )
    })?;
    Ok(loaded)
}

/// Puts a prepared certificate in place (ADR-074): the current pair is copied to
/// `previous-transport-*`, then the next key and certificate are renamed over the current
/// ones, key first. A start interrupted between the two renames finds the next certificate
/// alone and finishes the move.
fn promote_next(dir: &std::path::Path) -> Result<(), AletheiaError> {
    let next_cert = dir.join(NEXT_CERT_FILE);
    let next_key = dir.join(NEXT_KEY_FILE);
    let cert = dir.join(CERT_FILE);
    let key = dir.join(KEY_FILE);
    if next_cert.exists() && next_key.exists() {
        read_pair(&next_cert, &next_key)?;
        if cert.exists() && key.exists() {
            let old_cert = std::fs::read(&cert).map_err(|e| io_failure("read", &cert, &e))?;
            let old_key = std::fs::read(&key).map_err(|e| io_failure("read", &key, &e))?;
            let previous_key = dir.join(PREVIOUS_KEY_FILE);
            let previous_cert = dir.join(PREVIOUS_CERT_FILE);
            write_private(&previous_key, &old_key)
                .map_err(|e| io_failure("write", &previous_key, &e))?;
            std::fs::write(&previous_cert, old_cert)
                .map_err(|e| io_failure("write", &previous_cert, &e))?;
        }
        std::fs::rename(&next_key, &key).map_err(|e| io_failure("rename", &next_key, &e))?;
    }
    if next_cert.exists() && !next_key.exists() {
        std::fs::rename(&next_cert, &cert).map_err(|e| io_failure("rename", &next_cert, &e))?;
    }
    Ok(())
}

/// Writes `bytes` to `path` readable by its owner only (0600 on Unix), via a temporary file and
/// a rename so a crash never leaves half a key.
fn write_private(path: &std::path::Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let tmp = path.with_extension("tmp");
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&tmp)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    drop(file);
    std::fs::rename(&tmp, path)
}

/// Accepts any certificate unless one is pinned, and always verifies handshake signatures.
#[derive(Debug)]
struct PeerCertVerifier {
    /// Empty: any certificate.
    pinned: Vec<Hash32>,
    algorithms: WebPkiSupportedAlgorithms,
}

impl PeerCertVerifier {
    fn check(&self, end_entity: &CertificateDer<'_>) -> Result<(), rustls::Error> {
        if self.pinned.is_empty() || self.pinned.contains(&certificate_hash(end_entity)) {
            return Ok(());
        }
        Err(rustls::Error::General(
            "peer certificate is not a pinned one".to_owned(),
        ))
    }
}

impl ServerCertVerifier for PeerCertVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        self.check(end_entity)
            .map(|()| ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls12_signature(message, cert, dss, &self.algorithms)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls13_signature(message, cert, dss, &self.algorithms)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.algorithms.supported_schemes()
    }
}

impl ClientCertVerifier for PeerCertVerifier {
    fn client_auth_mandatory(&self) -> bool {
        true
    }

    fn root_hint_subjects(&self) -> &[DistinguishedName] {
        &[]
    }

    fn verify_client_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _now: UnixTime,
    ) -> Result<ClientCertVerified, rustls::Error> {
        self.check(end_entity)
            .map(|()| ClientCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls12_signature(message, cert, dss, &self.algorithms)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls13_signature(message, cert, dss, &self.algorithms)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.algorithms.supported_schemes()
    }
}

fn provider() -> Arc<CryptoProvider> {
    Arc::new(rustls::crypto::ring::default_provider())
}

/// Dialing side. `pinned` holds the certificates the peer may present (a validator's
/// registered one, and during a rotation its previous one); empty accepts any.
pub fn client_config(
    identity: &TransportCertificate,
    pinned: Vec<Hash32>,
) -> Result<Arc<ClientConfig>, AletheiaError> {
    let provider = provider();
    let verifier = Arc::new(PeerCertVerifier {
        pinned,
        algorithms: provider.signature_verification_algorithms,
    });
    let config = ClientConfig::builder_with_provider(provider)
        .with_protocol_versions(&[&rustls::version::TLS13])
        .map_err(|e| handshake_error(format!("TLS client configuration: {e}")))?
        .dangerous()
        .with_custom_certificate_verifier(verifier)
        .with_client_auth_cert(identity.chain(), identity.key())
        .map_err(|e| handshake_error(format!("TLS client certificate: {e}")))?;
    Ok(Arc::new(config))
}

/// Listening side. Every client must present a certificate.
pub fn server_config(identity: &TransportCertificate) -> Result<Arc<ServerConfig>, AletheiaError> {
    let provider = provider();
    let verifier = Arc::new(PeerCertVerifier {
        pinned: Vec::new(),
        algorithms: provider.signature_verification_algorithms,
    });
    let config = ServerConfig::builder_with_provider(provider)
        .with_protocol_versions(&[&rustls::version::TLS13])
        .map_err(|e| handshake_error(format!("TLS server configuration: {e}")))?
        .with_client_cert_verifier(verifier)
        .with_single_cert(identity.chain(), identity.key())
        .map_err(|e| handshake_error(format!("TLS server certificate: {e}")))?;
    Ok(Arc::new(config))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_node_keeps_its_certificate_across_restarts_and_refuses_a_mismatched_pair() {
        let dir = std::env::temp_dir().join(format!("aletheia-tls-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let first = TransportCertificate::load_or_create(&dir).unwrap();
        let again = TransportCertificate::load_or_create(&dir).unwrap();
        assert_eq!(
            first.hash(),
            again.hash(),
            "the same certificate after a restart"
        );

        // A key from another certificate is refused, never silently replaced.
        let other = TransportCertificate::generate().unwrap();
        std::fs::write(dir.join("transport-key.pk8"), &other.key_pkcs8).unwrap();
        let error = TransportCertificate::load_or_create(&dir).unwrap_err();
        assert_eq!(error.code(), ErrorCode::StoCorrupt);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_prepared_certificate_takes_over_on_the_next_start_and_the_old_one_is_kept() {
        let dir = std::env::temp_dir().join(format!("aletheia-tls-next-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let first = TransportCertificate::load_or_create(&dir).unwrap();
        let next = TransportCertificate::prepare_next(&dir).unwrap();
        assert_ne!(next, first.hash());
        assert_eq!(
            TransportCertificate::prepare_next(&dir).unwrap(),
            next,
            "asked twice before the start, the same one"
        );
        let started = TransportCertificate::load_or_create(&dir).unwrap();
        assert_eq!(started.hash(), next);
        assert!(!dir.join(NEXT_CERT_FILE).exists() && !dir.join(NEXT_KEY_FILE).exists());
        let previous =
            read_pair(&dir.join(PREVIOUS_CERT_FILE), &dir.join(PREVIOUS_KEY_FILE)).unwrap();
        assert_eq!(previous.hash(), first.hash());
        assert_eq!(
            TransportCertificate::load_or_create(&dir).unwrap().hash(),
            next
        );

        // A start interrupted after the key was moved finishes with the certificate.
        let after = TransportCertificate::prepare_next(&dir).unwrap();
        std::fs::rename(dir.join(NEXT_KEY_FILE), dir.join(KEY_FILE)).unwrap();
        assert_eq!(
            TransportCertificate::load_or_create(&dir).unwrap().hash(),
            after
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
