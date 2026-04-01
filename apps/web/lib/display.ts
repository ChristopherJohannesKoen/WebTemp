export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function roleTone(role: string) {
  if (role === 'owner') return 'amber';
  if (role === 'admin') return 'emerald';
  return 'slate';
}

export function projectTone(status: string) {
  if (status === 'completed') return 'emerald';
  if (status === 'paused') return 'amber';
  return 'slate';
}
