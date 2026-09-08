/**
 * WebSocket Connection Test Script
 * ---------------------------------
 * Tests WebSocket connectivity, event broadcasting, and recovery.
 * 
 * Usage:
 *   npm run test:ws
 */

import WebSocket from "ws";

const API_BASE = process.env["API_URL"] || "http://localhost:3000";
const WS_BASE = API_BASE.replace("http", "ws");

// Test credentials (from seed-test-account.ts)
const TEST_TOKEN = process.env["TEST_TOKEN"] || "";

if (!TEST_TOKEN) {
  console.error("❌ TEST_TOKEN environment variable required");
  console.log("\n1. Start backend: npm run dev");
  console.log("2. Create test account: npm run seed:test");
  console.log("3. Copy JWT token from output");
  console.log("4. Run: TEST_TOKEN=<token> npm run test:ws");
  process.exit(1);
}

interface WsEvent {
  event: string;
  [key: string]: unknown;
}

async function testWebSocket() {
  console.log("🧪 Testing WebSocket connection...\n");

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/api/v1/geo/ws?token=${TEST_TOKEN}`);
    const receivedEvents: WsEvent[] = [];
    let connectionTimestamp: Date | null = null;

    ws.on("open", () => {
      connectionTimestamp = new Date();
      console.log("✅ WebSocket connected");
      console.log(`   URL: ${WS_BASE}/api/v1/geo/ws`);
      console.log(`   Time: ${connectionTimestamp.toISOString()}\n`);
    });

    ws.on("message", (data: Buffer) => {
      const event = JSON.parse(data.toString()) as WsEvent;
      receivedEvents.push(event);

      console.log(`📨 Received event: ${event.event}`);
      console.log(`   Payload: ${JSON.stringify(event, null, 2)}\n`);

      // If we received ws.connected, test is complete
      if (event.event === "ws.connected") {
        console.log("✅ Connection handshake successful");
        ws.close();
      }
    });

    ws.on("ping", () => {
      console.log("💓 Ping received (heartbeat active)");
    });

    ws.on("pong", () => {
      console.log("💓 Pong sent");
    });

    ws.on("close", (code: number, reason: Buffer) => {
      console.log(`\n🔌 WebSocket closed`);
      console.log(`   Code: ${code}`);
      console.log(`   Reason: ${reason.toString() || "Normal closure"}`);

      if (receivedEvents.length === 0) {
        reject(new Error("No events received"));
      } else {
        console.log(`\n📊 Summary:`);
        console.log(`   Events received: ${receivedEvents.length}`);
        console.log(`   Event types: ${receivedEvents.map((e) => e.event).join(", ")}`);
        resolve();
      }
    });

    ws.on("error", (error: Error) => {
      console.error(`\n❌ WebSocket error: ${error.message}`);
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log("\n⏱️  Test timeout (10s) - closing connection");
        ws.close();
      }
    }, 10_000);
  });
}

async function testRecovery() {
  console.log("\n🧪 Testing event recovery endpoint...\n");

  // Calculate timestamp 1 minute ago
  const since = new Date(Date.now() - 60_000).toISOString();

  try {
    const response = await fetch(
      `${API_BASE}/api/v1/ws/events?since=${encodeURIComponent(since)}`,
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as { events: unknown[]; count: number };

    console.log("✅ Recovery endpoint working");
    console.log(`   Since: ${since}`);
    console.log(`   Events recovered: ${data.count}`);

    if (data.count > 0) {
      console.log(`   Event types: ${data.events.map((e: unknown) => (e as { event: string }).event).join(", ")}`);
    }
  } catch (error) {
    console.error(`❌ Recovery test failed: ${(error as Error).message}`);
    throw error;
  }
}

async function testHealthCheck() {
  console.log("\n🧪 Testing WebSocket health check...\n");

  try {
    const response = await fetch(`${API_BASE}/api/v1/ws/health`, {
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as {
      status: string;
      connections: number;
      rooms: Record<string, number>;
    };

    console.log("✅ Health check endpoint working");
    console.log(`   Status: ${data.status}`);
    console.log(`   Active connections: ${data.connections}`);
    console.log(`   Rooms: ${JSON.stringify(data.rooms, null, 2)}`);
  } catch (error) {
    console.error(`❌ Health check failed: ${(error as Error).message}`);
    throw error;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Epic 7: WebSocket Connection Test Suite");
  console.log("═══════════════════════════════════════════════════\n");

  try {
    // Test 1: WebSocket Connection
    await testWebSocket();

    // Test 2: Recovery Endpoint
    await testRecovery();

    // Test 3: Health Check
    await testHealthCheck();

    console.log("\n═══════════════════════════════════════════════════");
    console.log("  ✅ All tests passed!");
    console.log("═══════════════════════════════════════════════════\n");

    process.exit(0);
  } catch (error) {
    console.error("\n═══════════════════════════════════════════════════");
    console.error("  ❌ Tests failed");
    console.error("═══════════════════════════════════════════════════\n");
    console.error(error);
    process.exit(1);
  }
}

void main();
