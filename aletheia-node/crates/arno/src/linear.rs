//! The coins rules (spec Section 25, "Asset-safe"): a `Coins` value must be moved exactly
//! once - into a vault, a transfer, another routine or the result. Copying or dropping coins
//! does not compile.
//!
//! The check follows every path through a routine. A path that aborts (`fail`, a failing
//! `require`) reverts the transaction, so coins on it are not lost and need no move. `exit`
//! leaves normally, so everything must have been moved by then.
//!
//! ```text
//! A2004  'X' was already moved on line N and cannot be used again.
//! A2010  Coins value 'X' is never moved. Coins cannot be dropped.
//! A2011  'X' is moved on one path but not on another.
//! A2012  'X' is moved inside a loop, so it could be moved more than once.
//! A2013  'X' does not hold coins yet.
//! ```

use std::collections::BTreeMap;

use crate::diagnostics::Diagnostics;
use crate::hir::{Expr, ExprKind, LocalId, Method, Place, Program, RoutineDef, Stmt, StmtKind};
use crate::source::{SourceFile, Span};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum State {
    /// Declared, holds nothing yet (or its coins were moved: see `Moved`).
    Unset,
    /// Holds coins received at `Span`.
    Live(Span),
    /// Its coins were handed over at `Span`.
    Moved(Span),
}

impl State {
    fn empty(self) -> bool {
        !matches!(self, State::Live(_))
    }
}

/// Coins variables' states on the current path; `None` once the path has aborted or left.
type Flow = Option<BTreeMap<LocalId, State>>;

struct Linear<'a> {
    file: &'a SourceFile,
    routine: &'a RoutineDef,
    diagnostics: &'a mut Diagnostics,
}

impl Linear<'_> {
    fn name(&self, id: LocalId) -> &str {
        self.routine
            .locals
            .get(usize::from(id))
            .map_or("?", |l| l.name.as_str())
    }

    fn line(&self, span: Span) -> usize {
        self.file.line(span.start)
    }

    fn use_coins(&mut self, flow: &mut Flow, id: LocalId, span: Span, consume: bool) {
        let Some(states) = flow.as_mut() else { return };
        let Some(state) = states.get(&id).copied() else {
            return;
        };
        match state {
            State::Moved(at) => {
                let message = format!(
                    "'{}' was already moved on line {} and cannot be used again.",
                    self.name(id),
                    self.line(at)
                );
                self.diagnostics.error("A2004", span, message);
            }
            State::Unset => {
                let message = format!("'{}' does not hold coins yet.", self.name(id));
                self.diagnostics.error("A2013", span, message);
            }
            State::Live(_) => {
                if consume {
                    states.insert(id, State::Moved(span));
                }
            }
        }
    }

    fn place(&mut self, flow: &mut Flow, place: &Place, span: Span) {
        match place {
            Place::Local(id) => self.use_coins(flow, *id, span, false),
            Place::Storage(_) => {}
            Place::Field(inner, _) => self.place(flow, inner, span),
            Place::Index(inner, index) => {
                self.place(flow, inner, span);
                self.expr(flow, index);
            }
        }
    }

    fn expr(&mut self, flow: &mut Flow, expr: &Expr) {
        match &expr.kind {
            ExprKind::Int(_)
            | ExprKind::Bool(_)
            | ExprKind::Text(_)
            | ExprKind::EnumVariant { .. }
            | ExprKind::Nothing => {}
            ExprKind::Read(place) => self.place(flow, place, expr.span),
            ExprKind::Move(id) => self.use_coins(flow, *id, expr.span, true),
            ExprKind::Some(inner) | ExprKind::Convert(inner) | ExprKind::Unary(_, inner) => {
                self.expr(flow, inner);
            }
            ExprKind::Binary(_, left, right) => {
                self.expr(flow, left);
                self.expr(flow, right);
            }
            ExprKind::Call { args, .. }
            | ExprKind::Builtin { args, .. }
            | ExprKind::RecordValue { fields: args, .. } => {
                for arg in args {
                    self.expr(flow, arg);
                }
            }
            ExprKind::Method { op, receiver, args } => {
                for arg in args {
                    self.expr(flow, arg);
                }
                match (op, receiver) {
                    // Split and Join change a coins variable that stays live.
                    (Method::CoinsSplit | Method::CoinsJoin, Place::Local(id)) => {
                        self.use_coins(flow, *id, expr.span, false);
                    }
                    _ => self.place(flow, receiver, expr.span),
                }
            }
            ExprKind::Transfer { coins, to } => {
                self.expr(flow, coins);
                self.expr(flow, to);
            }
        }
    }

    fn dropped(&mut self, id: LocalId, span: Span) {
        let message = format!(
            "Coins value '{}' is never moved. Coins cannot be dropped.",
            self.name(id)
        );
        self.diagnostics.error("A2010", span, message);
    }

    /// Everything still live must be moved before a normal exit.
    fn check_empty(&mut self, flow: &Flow, at: Option<Span>) {
        let Some(states) = flow else { return };
        let live: Vec<(LocalId, Span)> = states
            .iter()
            .filter_map(|(id, state)| match state {
                State::Live(span) if Some(*id) != self.routine.result => Some((*id, *span)),
                _ => None,
            })
            .collect();
        for (id, span) in live {
            self.dropped(id, at.unwrap_or(span));
        }
    }

    fn block(&mut self, flow: &mut Flow, stmts: &[Stmt]) {
        for stmt in stmts {
            self.stmt(flow, stmt);
        }
    }

    /// Joins two paths. A path that aborted or left contributes nothing.
    fn merge(&mut self, a: Flow, b: Flow, span: Span) -> Flow {
        match (a, b) {
            (None, other) | (other, None) => other,
            (Some(mut a), Some(b)) => {
                for (id, state) in b {
                    let mine = a.get(&id).copied().unwrap_or(State::Unset);
                    if mine.empty() != state.empty() {
                        let message = format!(
                            "'{}' is moved on one path but not on another. Move it on every path, or on none.",
                            self.name(id)
                        );
                        self.diagnostics.error("A2011", span, message);
                        // Treat as moved so one mistake is reported once.
                        a.insert(id, State::Moved(span));
                    } else if let (State::Unset, State::Moved(_)) = (mine, state) {
                        a.insert(id, state);
                    }
                }
                Some(a)
            }
        }
    }

    /// A loop body may run any number of times: coins live before it cannot be moved in it,
    /// and coins received in it must be moved in the same pass.
    fn loop_body(&mut self, flow: &mut Flow, body: &[Stmt], span: Span) {
        let mut before = flow.clone();
        let mut inside = flow.clone();
        self.block(&mut inside, body);
        if let (Some(states), Some(after)) = (before.as_mut(), &inside) {
            for (id, state) in after {
                let was = states.get(id).copied().unwrap_or(State::Unset);
                if was.empty() != state.empty() {
                    if let State::Live(_) = was {
                        let message = format!(
                            "'{}' is moved inside a loop, so it could be moved more than once. Move it after the loop.",
                            self.name(*id)
                        );
                        self.diagnostics.error("A2012", span, message);
                        // Reported once; do not report it again as never moved.
                        states.insert(*id, State::Moved(span));
                    } else {
                        self.dropped(*id, span);
                    }
                }
            }
        }
        // After the loop the states are as before it (any mismatch was reported).
        *flow = before;
    }

    fn stmt(&mut self, flow: &mut Flow, stmt: &Stmt) {
        if flow.is_none() {
            return;
        }
        match &stmt.kind {
            StmtKind::Assign { place, value } => {
                self.expr(flow, value);
                match place {
                    Place::Local(id) if value.ty.is_linear() => {
                        if let Some(states) = flow.as_mut() {
                            if let Some(State::Live(_)) = states.get(id)
                                && Some(*id) != self.routine.result
                            {
                                self.dropped(*id, stmt.span);
                            }
                            states.insert(*id, State::Live(stmt.span));
                        }
                    }
                    other => self.place(flow, other, stmt.span),
                }
            }
            StmtKind::Eval(expr) => {
                self.expr(flow, expr);
                if expr.ty.is_linear() {
                    self.diagnostics.error(
                        "A2010",
                        expr.span,
                        "This produces coins that are never moved. Coins cannot be dropped; assign them or hand them over.",
                    );
                }
            }
            StmtKind::If {
                cond,
                then,
                otherwise,
            } => {
                self.expr(flow, cond);
                let mut a = flow.clone();
                let mut b = flow.clone();
                self.block(&mut a, then);
                self.block(&mut b, otherwise);
                *flow = self.merge(a, b, stmt.span);
            }
            StmtKind::Case {
                subject,
                arms,
                otherwise,
            } => {
                self.expr(flow, subject);
                let mut merged: Flow = None;
                let mut first = true;
                for (_, body) in arms {
                    let mut path = flow.clone();
                    self.block(&mut path, body);
                    merged = if first {
                        path
                    } else {
                        self.merge(merged, path, stmt.span)
                    };
                    first = false;
                }
                let mut path = flow.clone();
                self.block(&mut path, otherwise);
                *flow = if first {
                    path
                } else {
                    self.merge(merged, path, stmt.span)
                };
            }
            StmtKind::ForRange { from, to, body, .. } => {
                self.expr(flow, from);
                self.expr(flow, to);
                self.loop_body(flow, body, stmt.span);
            }
            StmtKind::ForEach {
                collection, body, ..
            } => {
                self.expr(flow, collection);
                self.loop_body(flow, body, stmt.span);
            }
            StmtKind::While { cond, body, .. } => {
                self.expr(flow, cond);
                self.loop_body(flow, body, stmt.span);
            }
            StmtKind::Require { cond, .. } => self.expr(flow, cond),
            StmtKind::Emit { args, .. } => {
                for arg in args {
                    self.expr(flow, arg);
                }
            }
            StmtKind::Fail(_) => *flow = None,
            StmtKind::Exit => {
                self.check_empty(flow, Some(stmt.span));
                *flow = None;
            }
        }
    }
}

/// Checks every routine's coins handling.
pub fn check(program: &Program, file: &SourceFile, diagnostics: &mut Diagnostics) {
    for routine in &program.routines {
        let mut states = BTreeMap::new();
        for (index, local) in routine.locals.iter().enumerate() {
            if !local.ty.is_linear() {
                continue;
            }
            let id = u16::try_from(index).unwrap_or(u16::MAX);
            let state = if id < routine.params {
                State::Live(local.span)
            } else {
                State::Unset
            };
            states.insert(id, state);
        }
        let mut checker = Linear {
            file,
            routine,
            diagnostics,
        };
        let mut flow = Some(states);
        checker.block(&mut flow, &routine.body);
        checker.check_empty(&flow, None);
    }
}
