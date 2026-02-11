
const oldRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
const newRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/;

const testCases = [
  { password: 'Password123!', description: 'Standard valid password' },
  { password: 'Password123#', description: 'Password with #' },
  { password: 'password123', description: 'Missing uppercase and special char' },
  { password: 'PASSWORD123!', description: 'Missing lowercase' },
  { password: 'Password!', description: 'Missing digit' },
  { password: 'Password123', description: 'Missing special char' },
];

console.log('Testing Old Regex:');
testCases.forEach(({ password, description }) => {
  const result = oldRegex.test(password);
  console.log(`[${result ? 'PASS' : 'FAIL'}] ${description} ("${password}")`);
});

console.log('\nTesting New Regex:');
testCases.forEach(({ password, description }) => {
  const result = newRegex.test(password);
  console.log(`[${result ? 'PASS' : 'FAIL'}] ${description} ("${password}")`);
});
