const fs = require('fs');
const os = require('os');
const path = require('path');

const state = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8')
);
const sessionSecret = state.auth.sessionSecret;

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
  const data = await gql(`
    {
      __schema {
        mutationType {
          fields {
            name
            args { name type { name kind ofType { name kind ofType { name } } } }
          }
        }
      }
    }
  `);
  const names = data.__schema.mutationType.fields
    .map((f) => f.name)
    .filter((n) => /android|keystore|credential/i.test(n));
  console.log(names.join('\n'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
