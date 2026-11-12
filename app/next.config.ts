import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // image Docker légère (app/Dockerfile)
  // Toutes les pages lisent la base à chaque requête : pas de Cache Components.
  serverExternalPackages: ["postgres", "neo4j-driver", "bcryptjs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
