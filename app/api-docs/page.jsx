'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

// Public, unauthenticated API documentation — deliberately placed outside the
// (app)/(admin)/(auth) route groups so it isn't caught by AppLayout's auth
// redirect (see app/(app)/layout.jsx). Matches CLAUDE.md's documented
// `GET /api-docs` Swagger UI route.
export default function ApiDocsPage() {
  return <SwaggerUI url="/api/openapi.json" />;
}
