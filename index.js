const dgram = require('dgram');
const server = dgram.createSocket('udp4');

const clients = {};
const CLIENT_TIMEOUT = 5000; // 客戶端超時時間（毫秒）

server.on('error', (err) => {
  console.error(`Server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  try {
    const data = JSON.parse(msg.toString());
    const { type, clientId, publicIp, publicPort } = data;

    if (type === 'register') {
      // 客戶端註冊
      clients[clientId] = { publicIp, publicPort, rinfo, lastSeen: Date.now() };
      console.log(`Client registered: ${clientId}`);
    } else if (type === 'query') {
      // 查詢另一個客戶端的公共IP和端口
      const otherClientId = data.otherClientId;
      const otherClient = clients[otherClientId];
      if (otherClient) {
        const response = {
          type: 'query_response',
          otherClientId,
          publicIp: otherClient.publicIp,
          publicPort: otherClient.publicPort
        };
        const responseMsg = Buffer.from(JSON.stringify(response));
        server.send(responseMsg, rinfo.port, rinfo.address, (err) => {
          if (err) console.error(`Error sending response to ${rinfo.address}:${rinfo.port}`);
        });
      } else {
        console.log(`Client ${otherClientId} not found`);
      }
    } else if (type === 'heartbeat') {
      // 心跳訊息
      if (clients[clientId]) {
        clients[clientId].lastSeen = Date.now();
      }
    } else if (type === 'unregister') {
      // 取消註冊
      if (clients[clientId]) {
        delete clients[clientId];
        console.log(`Client unregistered: ${clientId}`);
      } else {
        console.log(`Client ${clientId} not found for unregistering`);
      }
    }
  } catch (err) {
    console.error(`Error processing message: ${err}`);
  }
});

// 檢查客戶端超時
setInterval(() => {
  const now = Date.now();
  Object.keys(clients).forEach(clientId => {
    if (now - clients[clientId].lastSeen > CLIENT_TIMEOUT) {
      console.log(`Client ${clientId} timed out`);
      delete clients[clientId];
    }
  });
}, CLIENT_TIMEOUT);

server.on('listening', () => {
  const address = server.address();
  console.log(`UDP Hole Punching server listening on ${address.address}:${address.port}`);
});

server.bind(4000); // 伺服器監聽的端口
