import 'dotenv/config';
import * as subjectController from './src/controllers/subjectController.js';

async function testController() {
  console.log('Testing subjectController.create directly...');
  
  // Mock req and res
  const req = {
    body: {
      code: 'TEST' + Math.floor(Math.random() * 1000),
      name: 'Test Subject',
      description: 'Test Description',
      credits: 3,
      department: 'Khoa Công nghệ thông tin'
    },
    user: {
      id: 'e72a1471-4866-4f8a-a7c2-3357cfc127a7' // A valid user id from our database check
    },
    profile: {
      id: 'e72a1471-4866-4f8a-a7c2-3357cfc127a7',
      rank: 90
    }
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log(`Response status: ${this.statusCode}`);
      console.log('Response JSON:', data);
      return this;
    }
  };

  try {
    await subjectController.create(req, res);
  } catch (err) {
    console.error('Controller threw exception outside try-catch:', err);
  }
}

testController();
