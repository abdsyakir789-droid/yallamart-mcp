/**
 * YallaMart MCP Server — Cloudflare Worker
 * Protocol: MCP over HTTP (SSE)
 * Supabase Project: jgnjgfuypcelwjztebsy
 */

const SUPABASE_URL = 'https://jgnjgfuypcelwjztebsy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnbmpnZnV5cGNlbHdqenRlYnN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDU0MjksImV4cCI6MjA5Mjg4MTQyOX0.pg-BlEjwhkCquvl1QzsUC6whe3MA_au38W164Ovhx4c';

const TOOLS = [
  {
    name: 'get_ads',
    description: 'Ambil semua iklan/produk YallaMart. Bisa filter by seller, kategori, atau limit.',
    inputSchema: {
      type: 'object',
      properties: {
        limit:     { type: 'number', description: 'Jumlah data (default 20)' },
        seller_id: { type: 'string', description: 'Filter by seller UID' },
        search:    { type: 'string', description: 'Cari berdasarkan judul' },
      }
    }
  },
  {
    name: 'get_users',
    description: 'Ambil data user YallaMart.',
    inputSchema: {
      type: 'object',
      properties: {
        uid:   { type: 'string', description: 'UID user spesifik' },
        limit: { type: 'number', description: 'Jumlah data (default 20)' },
      }
    }
  },
  {
    name: 'get_orders',
    description: 'Ambil data pesanan YallaMart.',
    inputSchema: {
      type: 'object',
      properties: {
        buyer_id:  { type: 'string', description: 'Filter by buyer UID' },
        seller_id: { type: 'string', description: 'Filter by seller UID' },
        limit:     { type: 'number', description: 'Jumlah data (default 20)' },
      }
    }
  },
  {
    name: 'get_billboards',
    description: 'Ambil data billboard/banner YallaMart.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_stats',
    description: 'Ambil statistik YallaMart: jumlah user, ads, orders, dll.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_wishlists',
    description: 'Ambil data wishlist user.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Filter by user UID' },
      }
    }
  },
  {
    name: 'get_ad_views',
    description: 'Ambil data view count per iklan.',
    inputSchema: {
      type: 'object',
      properties: {
        ad_id: { type: 'string', description: 'Filter by ad ID' },
        limit: { type: 'number', description: 'Jumlah data (default 20)' },
      }
    }
  },
  {
    name: 'run_sql',
    description: 'Jalankan SQL query custom ke database YallaMart (read-only SELECT).',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'SQL SELECT query' },
      }
    }
  },
];

async function sb(path, params = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  return res.json();
}

async function sbRpc(fn, params = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params)
  });
  return res.json();
}

async function callTool(name, args) {
  switch(name) {

    case 'get_ads': {
      const params = { select: '*', order: 'created_at.desc', limit: args.limit || 20 };
      if(args.seller_id) params['seller_id'] = `eq.${args.seller_id}`;
      if(args.search)    params['title']     = `ilike.*${args.search}*`;
      const data = await sb('ads', params);
      return JSON.stringify(data, null, 2);
    }

    case 'get_users': {
      const params = { select: 'id,name,email,phone,photo,created_at,role', limit: args.limit || 20 };
      if(args.uid) params['id'] = `eq.${args.uid}`;
      const data = await sb('users', params);
      return JSON.stringify(data, null, 2);
    }

    case 'get_orders': {
      const params = { select: '*', order: 'created_at.desc', limit: args.limit || 20 };
      if(args.buyer_id)  params['buyer_id']  = `eq.${args.buyer_id}`;
      if(args.seller_id) params['seller_id'] = `eq.${args.seller_id}`;
      const data = await sb('orders', params);
      return JSON.stringify(data, null, 2);
    }

    case 'get_billboards': {
      const data = await sb('billboards', { select: '*', order: 'position.asc' });
      return JSON.stringify(data, null, 2);
    }

    case 'get_stats': {
      const [users, ads, orders, views] = await Promise.all([
        sb('users',    { select: 'id', limit: 1000 }),
        sb('ads',      { select: 'id', limit: 1000 }),
        sb('orders',   { select: 'id', limit: 1000 }),
        sb('ad_views', { select: 'id', limit: 1000 }),
      ]);
      return JSON.stringify({
        total_users:    Array.isArray(users)  ? users.length  : '?',
        total_ads:      Array.isArray(ads)    ? ads.length    : '?',
        total_orders:   Array.isArray(orders) ? orders.length : '?',
        total_ad_views: Array.isArray(views)  ? views.length  : '?',
      }, null, 2);
    }

    case 'get_wishlists': {
      const params = { select: '*', limit: 50 };
      if(args.user_id) params['user_id'] = `eq.${args.user_id}`;
      const data = await sb('wishlists', params);
      return JSON.stringify(data, null, 2);
    }

    case 'get_ad_views': {
      const params = { select: '*', order: 'view_count.desc', limit: args.limit || 20 };
      if(args.ad_id) params['ad_id'] = `eq.${args.ad_id}`;
      const data = await sb('ad_views', params);
      return JSON.stringify(data, null, 2);
    }

    case 'run_sql': {
      // Hanya izinkan SELECT
      const q = (args.query || '').trim().toLowerCase();
      if(!q.startsWith('select')) return JSON.stringify({ error: 'Hanya SELECT yang diizinkan' });
      const data = await sbRpc('execute_sql', { query: args.query });
      return JSON.stringify(data, null, 2);
    }

    default:
      return JSON.stringify({ error: `Tool tidak dikenal: ${name}` });
  }
}

// ── MCP Message Handler ──────────────────────────────────────
function mcpResponse(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function mcpError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleMcp(body) {
  const { method, params, id } = body;

  if(method === 'initialize') {
    return mcpResponse(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'yallamart-mcp', version: '1.0.0' },
      capabilities: { tools: {} }
    });
  }

  if(method === 'tools/list') {
    return mcpResponse(id, { tools: TOOLS });
  }

  if(method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      const content = await callTool(name, args || {});
      return mcpResponse(id, {
        content: [{ type: 'text', text: content }]
      });
    } catch(e) {
      return mcpError(id, -32000, e.message);
    }
  }

  return mcpError(id, -32601, `Method not found: ${method}`);
}

// ── Main Handler ─────────────────────────────────────────────
export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if(request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if(request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', name: 'yallamart-mcp' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if(request.method === 'POST') {
      try {
        const body = await request.json();
        const result = await handleMcp(body);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Method not allowed', { status: 405 });
  }
};

