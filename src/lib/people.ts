// Ownership labels.
//
// org_memberships carries a user_id and a role, not a display name, so the only
// person this app can name is the one holding the session. Everyone else is
// labelled by their relationship to the viewer rather than given an invented
// name. When a profiles table lands, this is the one place that changes.

export function ownerLabel(
  ownerId: string | null,
  viewerId: string | null,
): string {
  if (!ownerId) return "Unassigned";
  if (viewerId && ownerId === viewerId) return "You";
  return "Teammate";
}
