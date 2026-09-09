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
  const type = await gql(`
    {
      __type(name: "AndroidAppBuildCredentials") {
        fields { name type { kind name ofType { kind name ofType { name } } } }
      }
    }
  `);
  console.log('AndroidAppBuildCredentials fields:');
  console.log(
    (type.__type.fields || [])
      .map((f) => `${f.name}: ${f.type.name || f.type.ofType?.name || f.type.kind}`)
      .join('\n')
  );

  const ks = await gql(`
    {
      __type(name: "AndroidKeystore") {
        fields { name type { kind name ofType { kind name ofType { name } } } }
      }
    }
  `);
  console.log('\nAndroidKeystore fields:');
  console.log(
    (ks.__type.fields || [])
      .map((f) => `${f.name}: ${f.type.name || f.type.ofType?.name || f.type.kind}`)
      .join('\n')
  );

  const data = await gql(
    `
    query($id: String!) {
      app {
        byId(appId: $id) {
          androidAppCredentials(filter: { legacyOnly: false }) {
            id
            applicationIdentifier
            androidAppBuildCredentialsList {
              id
              name
              isDefault
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
    }
  `,
    { id: projectId }
  );

  for (const c of data.app.byId.androidAppCredentials || []) {
    console.log('\n===', c.applicationIdentifier, '===');
    for (const b of c.androidAppBuildCredentialsList || []) {
      console.log({
        name: b.name,
        isDefault: b.isDefault,
        buildCredentialsId: b.id,
        keystoreId: b.androidKeystore?.id,
        alias: b.androidKeystore?.keyAlias,
        sha1: b.androidKeystore?.sha1CertificateFingerprint,
      });
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
