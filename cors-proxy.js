import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/proxy', async (req, res) => {
  try {
    const { url, headers } = req.body;
    const response = await axios.get(url, { headers });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ CORS Proxy running on http://localhost:${PORT}`);
  console.log(`📝 Configure your app to use: http://localhost:${PORT}/proxy`);
});
