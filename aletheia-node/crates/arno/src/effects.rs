//! Effects and calls (spec Section 25, "Explicit effects" and "Safe by default").
//!
//! Each routine's used effects are collected from its body, including everything the
//! routines it calls do, and compared with what it declares:
//!
//! ```text
//! A3001  Function 'Status' is marked view but changes storage.
//! A3005  'Release' sends coins, but its effects list does not include 'sends coins'.
//! A6001  Routine 'Walk' calls itself. Recursion is not allowed in Arno 0.1.
//! A6002  Routines 'A' and 'B' call each other. Recursion is not allowed in Arno 0.1.
//! ```

use std::collections::BTreeSet;

use crate::ast::{Directive, Effect};
use crate::diagnostics::Diagnostics;
use crate::hir::{Expr, ExprKind, Method, Place, Program, Stmt, StmtKind};
use crate::source::Span;
use crate::types::Ty;

#[derive(Debug, Default)]
struct Usage {
    effects: BTreeSet<Effect>,
    /// Calls to other routines, with where they happen.
    calls: Vec<(u16, Span)>,
}

fn place_effects(place: &Place, usage: &mut Usage, writes: bool) {
    if writes && place.storage_root().is_some() {
        usage.effects.insert(Effect::ChangesStorage);
    }
    match place {
        Place::Index(inner, index) => {
            place_effects(inner, usage, false);
            expr(index, usage);
        }
        Place::Field(inner, _) => place_effects(inner, usage, false),
        Place::Local(_) | Place::Storage(_) => {}
    }
}

fn expr(e: &Expr, usage: &mut Usage) {
    match &e.kind {
        ExprKind::Int(_)
        | ExprKind::Bool(_)
        | ExprKind::Text(_)
        | ExprKind::Move(_)
        | ExprKind::EnumVariant { .. }
        | ExprKind::Nothing => {}
        ExprKind::Read(place) => place_effects(place, usage, false),
        ExprKind::Some(inner) | ExprKind::Convert(inner) | ExprKind::Unary(_, inner) => {
            expr(inner, usage);
        }
        ExprKind::Binary(_, l, r) => {
            expr(l, usage);
            expr(r, usage);
        }
        ExprKind::Builtin { args, .. } | ExprKind::RecordValue { fields: args, .. } => {
            for arg in args {
                expr(arg, usage);
            }
        }
        ExprKind::Call { routine, args } => {
            usage.calls.push((*routine, e.span));
            for arg in args {
                expr(arg, usage);
            }
        }
        ExprKind::Method { op, receiver, args } => {
            let writes = matches!(
                op,
                Method::VaultDeposit
                    | Method::VaultWithdraw
                    | Method::VaultWithdrawAll
                    | Method::ListAdd
                    | Method::MapPut
                    | Method::MapRemove
            );
            place_effects(receiver, usage, writes);
            for arg in args {
                expr(arg, usage);
            }
        }
        ExprKind::Transfer { coins, to } => {
            usage.effects.insert(Effect::SendsCoins);
            expr(coins, usage);
            expr(to, usage);
        }
    }
}

fn stmts(body: &[Stmt], usage: &mut Usage) {
    for stmt in body {
        match &stmt.kind {
            StmtKind::Assign { place, value } => {
                place_effects(place, usage, true);
                expr(value, usage);
            }
            StmtKind::Eval(e) | StmtKind::Require { cond: e, .. } => expr(e, usage),
            StmtKind::If {
                cond,
                then,
                otherwise,
            } => {
                expr(cond, usage);
                stmts(then, usage);
                stmts(otherwise, usage);
            }
            StmtKind::Case {
                subject,
                arms,
                otherwise,
            } => {
                expr(subject, usage);
                for (_, arm) in arms {
                    stmts(arm, usage);
                }
                stmts(otherwise, usage);
            }
            StmtKind::ForRange { from, to, body, .. } => {
                expr(from, usage);
                expr(to, usage);
                stmts(body, usage);
            }
            StmtKind::ForEach {
                collection, body, ..
            } => {
                expr(collection, usage);
                stmts(body, usage);
            }
            StmtKind::While { cond, body, .. } => {
                expr(cond, usage);
                stmts(body, usage);
            }
            StmtKind::Emit { args, .. } => {
                usage.effects.insert(Effect::EmitsEvents);
                for arg in args {
                    expr(arg, usage);
                }
            }
            StmtKind::Fail(_) | StmtKind::Exit => {}
        }
    }
}

/// Finds call cycles; reports each once.
fn recursion(program: &Program, usages: &[Usage], diagnostics: &mut Diagnostics) -> bool {
    let mut found = false;
    for (index, usage) in usages.iter().enumerate() {
        let me = u16::try_from(index).unwrap_or(u16::MAX);
        let name = |id: u16| {
            program
                .routines
                .get(usize::from(id))
                .map_or("?", |r| r.name.as_str())
        };
        for (callee, span) in &usage.calls {
            if *callee == me {
                diagnostics.error(
                    "A6001",
                    *span,
                    format!(
                        "Routine '{}' calls itself. Recursion is not allowed in Arno 0.1.",
                        name(me)
                    ),
                );
                found = true;
            } else if *callee > me && reaches(usages, *callee, me) {
                diagnostics.error(
                    "A6002",
                    *span,
                    format!(
                        "Routines '{}' and '{}' call each other. Recursion is not allowed in Arno 0.1.",
                        name(me),
                        name(*callee)
                    ),
                );
                found = true;
            }
        }
    }
    found
}

/// Whether `from` can reach `to` through calls.
fn reaches(usages: &[Usage], from: u16, to: u16) -> bool {
    let mut seen = BTreeSet::new();
    let mut stack = vec![from];
    while let Some(next) = stack.pop() {
        if next == to {
            return true;
        }
        if !seen.insert(next) {
            continue;
        }
        if let Some(usage) = usages.get(usize::from(next)) {
            stack.extend(usage.calls.iter().map(|(callee, _)| *callee));
        }
    }
    false
}

pub fn check(program: &Program, diagnostics: &mut Diagnostics) {
    let mut usages: Vec<Usage> = program
        .routines
        .iter()
        .map(|routine| {
            let mut usage = Usage::default();
            if routine
                .locals
                .iter()
                .take(usize::from(routine.params))
                .any(|local| matches!(local.ty, Ty::Coins(_)))
            {
                usage.effects.insert(Effect::ReceivesCoins);
            }
            stmts(&routine.body, &mut usage);
            usage
        })
        .collect();
    if recursion(program, &usages, diagnostics) {
        return;
    }
    // Callers do what their callees do. No cycles, so a fixed number of rounds suffices.
    for _ in 0..program.routines.len() {
        let mut changed = false;
        for index in 0..usages.len() {
            let inherited: BTreeSet<Effect> = usages
                .get(index)
                .map(|u| {
                    u.calls
                        .iter()
                        .filter_map(|(callee, _)| usages.get(usize::from(*callee)))
                        .flat_map(|callee| callee.effects.iter().copied())
                        // Receiving coins is about a routine's own parameters.
                        .filter(|effect| *effect != Effect::ReceivesCoins)
                        .collect()
                })
                .unwrap_or_default();
            if let Some(usage) = usages.get_mut(index) {
                for effect in inherited {
                    changed |= usage.effects.insert(effect);
                }
            }
        }
        if !changed {
            break;
        }
    }
    for (routine, usage) in program.routines.iter().zip(&usages) {
        if routine.has(Directive::View) {
            if let Some(effect) = usage.effects.iter().next() {
                diagnostics.error(
                    "A3001",
                    routine.name_span,
                    format!(
                        "Function '{}' is marked view but {}.",
                        routine.name,
                        effect.phrase()
                    ),
                );
            }
            continue;
        }
        for effect in &usage.effects {
            if !routine.declared_effects.contains(effect) {
                diagnostics.error(
                    "A3005",
                    routine.name_span,
                    format!(
                        "'{}' {}, but its effects list does not include '{}'.",
                        routine.name,
                        effect.phrase(),
                        effect.phrase()
                    ),
                );
            }
        }
    }
}
