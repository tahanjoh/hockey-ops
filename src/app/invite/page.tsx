import InviteWelcome from "./InviteWelcome";

export default async function InvitePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const raw = query.invitation;
  const invitationId = typeof raw === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ? raw : null;
  return <InviteWelcome invitationId={invitationId} />;
}
