import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router as apiRoutes } from './src/routes/index.js';

// We want to mock authMiddleware to bypass token validation but attach req.user and req.profile
// To do this, we can intercept the authMiddleware or just define a local mock before mounting routes
const app = express();
app.use(cors());
app.use(express.json());

// Mock authMiddleware by defining a global middleware that attaches user/profile
app.use((req, res, next) => {
  req.user = { id: 'e72a1471-4866-4f8a-a7c2-3357cfc127a7' };
  req.profile = { id: 'e72a1471-4866-4f8a-a7c2-3357cfc127a7', rank: 90 };
  next();
});

// Mount routes
app.use('/api', apiRoutes);

const server = app.listen(3001, async () => {
  console.log('Test server listening on port 3001');

  // Let's make a POST request to create a subject proposal
  const payload = {
    code: 'TEST' + Math.floor(Math.random() * 1000),
    name: 'Test Subject Propose',
    description: 'Test Description',
    credits: 3,
    department: 'Khoa Công nghệ thông tin'
  };

  console.log('Sending first POST request to /api/subjects...');
  try {
    const response = await fetch('http://localhost:3001/api/subjects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    console.log(`First request status: ${response.status}`);
    const data = await response.json();
    console.log('First request response body:', data);
  } catch (err) {
    console.error('First request failed with error:', err);
  }

  // Let's make a second request to see if it behaves differently
  console.log('Sending second POST request to /api/subjects...');
  payload.code = 'TEST' + Math.floor(Math.random() * 1000);
  try {
    const response = await fetch('http://localhost:3001/api/subjects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    console.log(`Second request status: ${response.status}`);
    const data = await response.json();
    console.log('Second request response body:', data);
  } catch (err) {
    console.error('Second request failed with error:', err);
  }

  // Close server
  server.close();
});
