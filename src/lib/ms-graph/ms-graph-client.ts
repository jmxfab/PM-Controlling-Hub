import "isomorphic-fetch";
import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

export interface GraphEmail {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  body: { content: string; contentType: string } | null;
  receivedDateTime: string;
  from: {
    emailAddress: { name: string; address: string };
  } | null;
}

function getGraphClient(): Client {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "AZURE_TENANT_ID, AZURE_CLIENT_ID und AZURE_CLIENT_SECRET sind erforderlich."
    );
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  return Client.initWithMiddleware({ authProvider });
}

export async function fetchUnreadEmails(maxCount = 50): Promise<GraphEmail[]> {
  const mailbox = process.env.AZURE_MAILBOX_EMAIL;
  if (!mailbox) {
    throw new Error("AZURE_MAILBOX_EMAIL ist nicht gesetzt.");
  }

  const client = getGraphClient();

  const response = await client
    .api(`/users/${mailbox}/messages`)
    .filter("isRead eq false")
    .select("id,subject,bodyPreview,body,receivedDateTime,from")
    .orderby("receivedDateTime desc")
    .top(maxCount)
    .get();

  return (response.value as GraphEmail[]) ?? [];
}
