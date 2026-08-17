const fs = require('fs');
const path = require('path');

const seedData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'demo-seed-data.json'), 'utf8'),
);

const seedScript = `
const token = pm.environment.get('token') || pm.collectionVariables.get('token');
const baseUrl = (pm.environment.get('baseUrl') || pm.collectionVariables.get('baseUrl') || '').replace(/\\/$/, '');

if (!token) {
  throw new Error('Run Login first to set the token variable.');
}
if (!baseUrl) {
  throw new Error('Set baseUrl in the environment (e.g. https://xxx.execute-api.../api).');
}

const DEMO_EMPLOYEES = ${JSON.stringify(seedData.employees, null, 2)};

function sendRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      url: baseUrl + urlPath,
      method,
      header: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
    };

    if (body !== undefined) {
      options.body = { mode: 'raw', raw: JSON.stringify(body) };
    }

    pm.sendRequest(options, (err, response) => {
      if (err) {
        reject(err);
        return;
      }

      let json;
      try {
        json = response.json();
      } catch (parseError) {
        json = { raw: response.text() };
      }

      if (response.code >= 400) {
        reject(new Error(method + ' ' + urlPath + ' failed (' + response.code + '): ' + JSON.stringify(json)));
        return;
      }

      resolve(json);
    });
  });
}

const existing = await sendRequest('GET', '/employees?limit=200&offset=0');
const alreadySeeded = (existing.data || []).some((employee) => employee.name === 'Amara Perera');

if (alreadySeeded) {
  console.warn('Demo data already present (Amara Perera found). Skipping seed to avoid duplicates.');
} else {
  let employeesCreated = 0;
  let recordsCreated = 0;
  const jobTestSummary = [];

  for (const employee of DEMO_EMPLOYEES) {
    const createdEmployee = await sendRequest('POST', '/employees', {
      name: employee.name,
      department: employee.department,
    });
    employeesCreated += 1;

    for (const record of employee.records) {
      const createdRecord = await sendRequest('POST', '/compliance-records', {
        employeeId: createdEmployee.id,
        type: record.type,
        issuedDate: record.issuedDate,
        expiryDate: record.expiryDate,
        notes: record.notes,
      });
      recordsCreated += 1;

      if ((record.notes || '').includes('JOB-TEST')) {
        jobTestSummary.push({
          employee: employee.name,
          recordId: createdRecord.id,
          type: record.type,
          expiryDate: record.expiryDate,
          statusNow: createdRecord.status,
          notes: record.notes,
        });
      }
    }
  }

  pm.collectionVariables.set('seedEmployeesCreated', String(employeesCreated));
  pm.collectionVariables.set('seedRecordsCreated', String(recordsCreated));
  pm.collectionVariables.set('seedJobTestSummary', JSON.stringify(jobTestSummary, null, 2));

  console.log('Seed complete: ' + employeesCreated + ' employees, ' + recordsCreated + ' compliance records.');
  console.log('JOB-TEST records:\\n' + JSON.stringify(jobTestSummary, null, 2));
}
`.trim();

const collection = {
  info: {
    _postman_id: 'c7f3a1b2-4d5e-6f78-9012-3456789abcde',
    name: 'Compliance Tracking - Demo Data',
    description:
      'Seed realistic employees and compliance records for production/staging verification.\\n\\n**Run order:**\\n1. Select the *Production* environment and set `baseUrl`, `username`, `password`.\\n2. **Auth → Login**\\n3. **Demo Data → Seed All Demo Data**\\n4. **Demo Data → Get Metrics** (baseline before 1am job)\\n5. After the 1am Asia/Colombo job on 2026-08-17, run **After 1am Job** folder requests.\\n\\nSee `postman/demo-seed-data.json` for JOB-TEST transition expectations.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'https://6dwo549x25.execute-api.ap-southeast-1.amazonaws.com/api' },
    { key: 'token', value: '' },
    { key: 'seedEmployeesCreated', value: '' },
    { key: 'seedRecordsCreated', value: '' },
    { key: 'seedJobTestSummary', value: '' },
  ],
  item: [
    {
      name: 'Auth',
      item: [
        {
          name: 'Login',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('Login succeeded', function () {",
                  '  pm.expect(pm.response.code).to.be.oneOf([200, 201]);',
                  '});',
                  '',
                  "const json = pm.response.json();",
                  "pm.environment.set('token', json.accessToken);",
                  "pm.collectionVariables.set('token', json.accessToken);",
                  "console.log('Token saved to environment and collection variables.');",
                ],
              },
            },
          ],
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: '{\n  "username": "{{username}}",\n  "password": "{{password}}"\n}',
            },
            url: '{{baseUrl}}/auth/login',
            description: 'Authenticate and store JWT in `token`. Required before seeding.',
          },
          response: [],
        },
      ],
    },
    {
      name: 'Demo Data',
      item: [
        {
          name: 'Seed All Demo Data',
          event: [
            {
              listen: 'prerequest',
              script: {
                type: 'text/javascript',
                exec: seedScript.split('\n'),
              },
            },
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('Metrics reachable after seed', function () {",
                  '  pm.response.to.have.status(200);',
                  '});',
                  '',
                  "const employeesCreated = pm.collectionVariables.get('seedEmployeesCreated');",
                  "const recordsCreated = pm.collectionVariables.get('seedRecordsCreated');",
                  "if (employeesCreated) {",
                  "  console.log('Created ' + employeesCreated + ' employees and ' + recordsCreated + ' records.');",
                  '}',
                  "const jobTests = pm.collectionVariables.get('seedJobTestSummary');",
                  'if (jobTests) {',
                  "  console.log('JOB-TEST summary:\\n' + jobTests);",
                  '}',
                ],
              },
            },
          ],
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
            url: '{{baseUrl}}/dashboard/metrics',
            description:
              'Creates 20 employees and ~45 compliance records via pre-request script, then loads metrics as a sanity check. Skips if Amara Perera already exists.',
          },
          response: [],
        },
        {
          name: 'Get Metrics (baseline)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('Metrics returned', function () {",
                  '  pm.response.to.have.status(200);',
                  '});',
                  '',
                  "const json = pm.response.json();",
                  "console.log('Totals before job:', JSON.stringify(json.totals, null, 2));",
                  "pm.collectionVariables.set('metricsBeforeJob', JSON.stringify(json.totals));",
                ],
              },
            },
          ],
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
            url: '{{baseUrl}}/dashboard/metrics',
          },
          response: [],
        },
        {
          name: 'List JOB-TEST Records',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('Records listed', function () {",
                  '  pm.response.to.have.status(200);',
                  '});',
                  '',
                  "const json = pm.response.json();",
                  "const jobTests = (json.data || []).filter((record) => (record.notes || '').includes('JOB-TEST'));",
                  "console.log('JOB-TEST records (' + jobTests.length + '):');",
                  'jobTests.forEach((record) => {',
                  "  console.log('- id=' + record.id + ' status=' + record.status + ' expiry=' + record.expiryDate + ' notes=' + record.notes);",
                  '});',
                ],
              },
            },
          ],
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
            url: {
              raw: '{{baseUrl}}/compliance-records?limit=200&offset=0',
              host: ['{{baseUrl}}'],
              path: ['compliance-records'],
              query: [
                { key: 'limit', value: '200' },
                { key: 'offset', value: '0' },
              ],
            },
            description: 'Lists all records and prints JOB-TEST rows to the Postman console.',
          },
          response: [],
        },
      ],
    },
    {
      name: 'After 1am Job (2026-08-17 Asia/Colombo)',
      item: [
        {
          name: 'Get Metrics (after job)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('Metrics returned', function () {",
                  '  pm.response.to.have.status(200);',
                  '});',
                  '',
                  "const json = pm.response.json();",
                  "const beforeRaw = pm.collectionVariables.get('metricsBeforeJob');",
                  "console.log('Totals after job:', JSON.stringify(json.totals, null, 2));",
                  'if (beforeRaw) {',
                  "  console.log('Totals before job:', beforeRaw);",
                  '}',
                ],
              },
            },
          ],
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
            url: '{{baseUrl}}/dashboard/metrics',
            description: 'Run after the scheduled Lambda job. Compare totals with baseline.',
          },
          response: [],
        },
        {
          name: 'List Expired Records',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
            url: {
              raw: '{{baseUrl}}/compliance-records?status=expired&limit=200&offset=0',
              host: ['{{baseUrl}}'],
              path: ['compliance-records'],
              query: [
                { key: 'status', value: 'expired' },
                { key: 'limit', value: '200' },
                { key: 'offset', value: '0' },
              ],
            },
            description: 'Expect JOB-TEST-A (Amara Perera visa, expiry 2026-08-16) here after the job.',
          },
          response: [],
        },
        {
          name: 'List Expiring Records',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
            url: {
              raw: '{{baseUrl}}/compliance-records?status=expiring&limit=200&offset=0',
              host: ['{{baseUrl}}'],
              path: ['compliance-records'],
              query: [
                { key: 'status', value: 'expiring' },
                { key: 'limit', value: '200' },
                { key: 'offset', value: '0' },
              ],
            },
            description: 'Expect JOB-TEST-B (Rajesh Kumar background_check, expiry 2026-09-16) here after the job.',
          },
          response: [],
        },
        {
          name: 'Verify JOB-TEST Transitions',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('Records listed', function () {",
                  '  pm.response.to.have.status(200);',
                  '});',
                  '',
                  "const expected = [",
                  "  { tag: 'JOB-TEST-A', employeeName: 'Amara Perera', expiryDate: '2026-08-16', expectedStatus: 'expired' },",
                  "  { tag: 'JOB-TEST-B', employeeName: 'Rajesh Kumar', expiryDate: '2026-09-16', expectedStatus: 'expiring' },",
                  "  { tag: 'JOB-TEST-C', employeeName: 'Nimali Fernando', expiryDate: '2026-08-15', expectedStatus: 'expired' },",
                  "  { tag: 'JOB-TEST-D', employeeName: 'Priya Sivan', expiryDate: '2026-08-17', expectedStatus: 'expiring' },",
                  "  { tag: 'JOB-TEST-E', employeeName: 'Marcus Silva', expiryDate: '2026-09-17', expectedStatus: 'active' },",
                  '];',
                  '',
                  "const json = pm.response.json();",
                  "const records = json.data || [];",
                  '',
                  'expected.forEach((item) => {',
                  "  const match = records.find((record) => (record.notes || '').includes(item.tag));",
                  "  pm.test(item.tag + ' record exists', function () {",
                  "    pm.expect(match, item.tag + ' not found').to.exist;",
                  '  });',
                  '  if (match) {',
                  "    pm.test(item.tag + ' status is ' + item.expectedStatus, function () {",
                  '      pm.expect(match.status).to.eql(item.expectedStatus);',
                  '    });',
                  "    console.log(item.tag + ': id=' + match.id + ' status=' + match.status + ' expiry=' + match.expiryDate);",
                  '  }',
                  '});',
                ],
              },
            },
          ],
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
            url: {
              raw: '{{baseUrl}}/compliance-records?limit=200&offset=0',
              host: ['{{baseUrl}}'],
              path: ['compliance-records'],
              query: [
                { key: 'limit', value: '200' },
                { key: 'offset', value: '0' },
              ],
            },
            description: 'Automated assertions for the five JOB-TEST records after the 1am job.',
          },
          response: [],
        },
      ],
    },
  ],
};

const environment = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Compliance Tracking - Production',
  values: [
    {
      key: 'baseUrl',
      value: 'https://6dwo549x25.execute-api.ap-southeast-1.amazonaws.com/api',
      type: 'default',
      enabled: true,
    },
    {
      key: 'username',
      value: 'admin',
      type: 'default',
      enabled: true,
    },
    {
      key: 'password',
      value: '',
      type: 'secret',
      enabled: true,
    },
    {
      key: 'token',
      value: '',
      type: 'secret',
      enabled: true,
    },
  ],
  _postman_variable_scope: 'environment',
};

fs.writeFileSync(
  path.join(__dirname, 'compliance-tracking-demo-data.postman_collection.json'),
  JSON.stringify(collection, null, 2),
);
fs.writeFileSync(
  path.join(__dirname, 'compliance-tracking-production.postman_environment.json'),
  JSON.stringify(environment, null, 2),
);

console.log('Generated Postman collection and environment files.');
