const fs = require('fs');
const os = require('os');
const path = require('path');

const state = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8')
);
const sessionSecret = state.auth.sessionSecret;
const projectId = '6564e120-c3bc-4b5a-ad08-5f2d235c21fa';

async function gql(query, variables = {}) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'expo-session': sessionSecret,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    throw new Error('GraphQL error');
  }
  return json.data;
}

(async () => {
  const data = await gql(
    `
    query($id: String!) {
      app {
        byId(appId: $id) {
          id
          fullName
          androidAppCredentials(filter: { legacyOnly: false }) {
            id
            applicationIdentifier
            androidKeystore {
              id
              keyAlias
              type
              md5CertificateFingerprint
              sha1CertificateFingerprint
              sha256CertificateFingerprint
            }
          }
        }
      }
    }
  `,
    { id: projectId }
  );

  const creds = data.app.byId.androidAppCredentials || [];
  for (const c of creds) {
    console.log('---');
    console.log('applicationIdentifier:', c.applicationIdentifier);
    console.log('credentialsId:', c.id);
    console.log('keystoreId:', c.androidKeystore?.id);
    console.log('keyAlias:', c.androidKeystore?.keyAlias);
    console.log('sha1:', c.androidKeystore?.sha1CertificateFingerprint);
    console.log('type:', c.androidKeystore?.type);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
