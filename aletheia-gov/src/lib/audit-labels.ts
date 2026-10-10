// Plain-language names for audit actions, for people reading the workbench.
const LABELS: Record<string, string> = {
  "auth.sign_in": "Signed in",
  "auth.sign_out": "Signed out",
  "auth.sign_out_everywhere": "Signed out everywhere",
  "auth.change_password": "Changed password",
  "interest.list": "Viewed the list of registrations",
  "interest.view": "Opened a registration",
  "interest.status": "Changed a registration’s status",
  "cv.download": "Downloaded a CV",
  "cv.preview": "Previewed a CV",
  "user.create": "Added an account",
  "user.roles": "Changed an account’s roles",
  "user.reset_password": "Reset an account’s password",
  "user.disable": "Disabled an account",
  "user.enable": "Re-enabled an account",
  "user.bootstrap": "First administrator created",
  "interest.cleared": "Practice registrations cleared",
  "user.qa_create": "Test account created",
  "user.qa_delete": "Test account removed",
};

export function auditLabel(action: string): string {
  return LABELS[action] ?? action;
}
