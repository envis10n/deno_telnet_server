# Deno Telnet Server

A simple Telnet server written for Deno.

## Usage

The server is a regular TCP listener wrapped into a containing class that extends an event emitter.

Each client connected is given a UUID and stored.
Each client is also given a Telnet parser that handles generating events and automatically negotiates with the client based on supported options.

The events emitted by the server are what drives any interaction with the system:

```ts
interface Events {
    connect(client: TcpClient): void;
    text(client: TcpClient, data: string): void;
    subnegotiation(
        client: TcpClient,
        option: number,
        payload: Uint8Array,
    ): void;
    gmcp(
        client: TcpClient,
        namespace: string,
        payload: { [key: string]: any } | string[] | string,
    ): void;
    disconnect(client: TcpClient): void;
    error(err: Error): void;
    close(): void;
}
```

Very basic GMCP support is baked in. Be sure to check the type of the payload before doing anything with it.

### Example

A simple echo server:

```ts
import { TelnetServer } from "https://deno.land/x/deno_telnet_server@0.1.1/mod.ts";

const server = new TelnetServer({port: 3000});

// Listen for events
server.on("connect", (client) => {
    console.log("Client connected:", client.uuid);
});

server.on("text", (client, text) => {
    console.log("[", client.uuid, "]:", text);
    client.send(text);
});

server.on("disconnect", (client) => {
    console.log("Client disconnected:", client.uuid);
});
```
