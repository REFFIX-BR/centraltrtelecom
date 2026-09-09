const fs = require('fs');
const os = require('os');
const path = require('path');

const state = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8')
);
const sessionSecret = state.auth.sessionSecret;

const BUILD_CREDENTIALS_ID = 'd6445d25-115a-4ae5-8483-fec2a77f3bd5'; // central.tr.telecom default
const OLD_KEYSTORE_ID = '89760103-3e0d-4421-938a-bab4d54bcd1b'; // com.trtelecom.central / expected by Play

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
    mutation($id: ID!, $keystoreId: ID!) {
      androidAppBuildCredentials {
        setKeystore(id: $id, keystoreId: $keystoreId) {
          id
          name
          isDefault
          androidKeystore {
            id
            sha1CertificateFingerprint
            keyAlias
          }
        }
      }
    }
  `,
    { id: BUILD_CREDENTIALS_ID, keystoreId: OLD_KEYSTORE_ID }
  );

  const result = data.androidAppBuildCredentials.setKeystore;
  console.log('Updated build credentials:');
  console.log(JSON.stringify(result, null, 2));
  const sha1 = result.androidKeystore.sha1CertificateFingerprint;
  const expected = '90367a94c3f29e7cea0befd9bba9a016fc883bac';
  console.log('matchesPlayExpected:', sha1.toLowerCase() === expected);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
