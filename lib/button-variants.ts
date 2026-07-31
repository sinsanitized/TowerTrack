export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn btn-primary",
  secondary: "btn",
  destructive: "btn btn-destructive",
  ghost: "btn btn-ghost",
};

export function buttonClass(variant: ButtonVariant, additionalClasses = "") {
  return `${variantClasses[variant]} ${additionalClasses}`.trim();
}
