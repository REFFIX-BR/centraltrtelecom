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
  for (const name of ['AndroidKeystoreMutation', 'AndroidAppBuildCredentialsMutation', 'AndroidAppCredentialsMutation']) {
    const data = await gql(`{ __type(name: "${name}") { fields { name args { name type { name kind ofType { name kind ofType { name } } } } } } }`);
    console.log('\n##', name);
    for (const f of data.__type?.fields || []) {
      console.log('-', f.name, JSON.stringify(f.args.map((a) => a.name)));
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
