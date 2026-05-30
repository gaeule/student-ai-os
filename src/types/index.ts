export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type User = {
  name: string;
  email: string;
  avatarUrl?: string;
};
