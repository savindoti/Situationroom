import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser for API routes
  app.use(express.json());

  // API Route to proxy bipadportal
  app.get("/api/bipad/incidents", async (req, res) => {
    try {
      // Reconstruct query parameters
      const url = new URL("https://bipadportal.gov.np/api/v1/incident/");
      Object.entries(req.query).forEach(([key, value]) => {
        url.searchParams.append(key, value as string);
      });

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Node-Proxy/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Bipad API returned ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Bipad Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch from Bipad Portal" });
    }
  });

  // API Route to proxy gdacs
  app.get("/api/gdacs/events", async (req, res) => {
    try {
      const url = new URL("https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP");
      Object.entries(req.query).forEach(([key, value]) => {
        url.searchParams.append(key, value as string);
      });

      const response = await fetch(url.toString(), {
         headers: {
            'Accept': 'application/json',
            'User-Agent': 'Node-Proxy/1.0'
         }
      });
      if (!response.ok) {
        throw new Error(`GDACS API returned ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("GDACS Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch from GDACS" });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Note: process.cwd() is used, but __dirname might be explicitly needed 
    // depending on Node version, but process.cwd() is safe running from root.
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support React Router HTML fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
