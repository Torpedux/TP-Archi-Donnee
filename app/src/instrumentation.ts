// Appelé une fois au démarrage du serveur Next, avant la première requête.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initialiser } = await import("@/init");
  await initialiser();
}
