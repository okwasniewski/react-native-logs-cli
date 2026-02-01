import WebSocket from "ws";

export type CdpConnection = {
  close: () => void;
  send: (payload: unknown) => void;
  onMessage: (handler: (data: unknown) => void) => void;
  onClose: (handler: () => void) => void;
  onError: (handler: (error: Error) => void) => void;
};

/**
 * Connect to a CDP websocket endpoint.
 */
export async function connectCdpAsync(url: string): Promise<CdpConnection> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);

    socket.once("open", () => {
      const connection: CdpConnection = {
        close: () => socket.close(),
        send: (payload) => socket.send(JSON.stringify(payload)),
        onMessage: (handler) => {
          socket.on("message", (data) => {
            const text = typeof data === "string" ? data : data.toString();
            try {
              handler(JSON.parse(text));
            } catch {
              handler(text);
            }
          });
        },
        onClose: (handler) => socket.on("close", handler),
        onError: (handler) => socket.on("error", handler)
      };

      resolve(connection);
    });

    socket.once("error", (error) => {
      reject(error);
    });
  });
}
