use zeroize::Zeroize;

/// Holder for secret material: zeroized on drop, never printable, never cloned.
///
/// There is deliberately no `Debug`, `Display`, `Clone` or serialization impl, so a secret
/// cannot reach a log line, an error detail or a copy by accident (CLAUDE.md directive 7).
/// Code that needs the value calls [`Secret::expose`], which is easy to find in review.
#[allow(
    missing_debug_implementations,
    reason = "a Debug impl is exactly what this type exists to prevent"
)]
pub struct Secret<T: Zeroize> {
    value: T,
}

impl<T: Zeroize> Secret<T> {
    pub fn new(value: T) -> Secret<T> {
        Secret { value }
    }

    pub fn expose(&self) -> &T {
        &self.value
    }

    /// Mutable access, for filling a secret in place (e.g. from the CSPRNG) so the material
    /// never exists outside the wrapper.
    pub fn expose_mut(&mut self) -> &mut T {
        &mut self.value
    }
}

impl<T: Zeroize> Drop for Secret<T> {
    fn drop(&mut self) {
        self.value.zeroize();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_the_wrapped_value() {
        let secret = Secret::new([7u8; 4]);
        assert_eq!(secret.expose(), &[7u8; 4]);
    }

    /// Fails to compile if `Secret` ever implements `Debug` or `Clone`: the second blanket
    /// impl makes `ambiguous()` ambiguous exactly for types that implement the trait.
    #[test]
    fn cannot_be_debugged_or_cloned() {
        trait AmbiguousIfDebug<A> {
            fn ambiguous() {}
        }
        impl<T: ?Sized> AmbiguousIfDebug<()> for T {}
        struct IsDebug;
        impl<T: ?Sized + core::fmt::Debug> AmbiguousIfDebug<IsDebug> for T {}
        <Secret<[u8; 32]> as AmbiguousIfDebug<_>>::ambiguous();

        trait AmbiguousIfClone<A> {
            fn ambiguous() {}
        }
        impl<T: ?Sized> AmbiguousIfClone<()> for T {}
        struct IsClone;
        impl<T: Clone> AmbiguousIfClone<IsClone> for T {}
        <Secret<[u8; 32]> as AmbiguousIfClone<_>>::ambiguous();
    }
}
