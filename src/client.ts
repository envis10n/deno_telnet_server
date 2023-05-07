import { iterateReader } from "std/streams/iterate_reader.ts";
import {
    EventType,
    TelnetEvent,
    TelnetParser,
} from "https://deno.land/x/denotel@0.1.6/mod.ts";

/**
 * A TCP client socket with a Telnet parsing wrapper.
 */
export class TelnetClient {
    public readonly uuid: string = crypto.randomUUID();
    public readonly parser: TelnetParser = new TelnetParser();
    constructor(public readonly socket: Deno.Conn) {}
    /**
     * Write a buffer directly to the client.
     * @param chunk The data to be sent.
     * @returns The number of bytes sent.
     */
    async write(chunk: Uint8Array): Promise<number> {
        return await this.socket.write(chunk);
    }
    /**
     * Send a string to the client, being processed by the parser first.
     * @param data String data to be sent to the client.
     * @returns The number of bytes sent.
     */
    async send(data: string): Promise<number> {
        return await this.write(this.parser.send(data));
    }
    /**
     * Close the underlying socket.
     */
    close(): void {
        this.socket.close();
    }
    /**
     * Asynchronously read chunks from the socket and yield on TelnetEvents.
     * Automatically sends any Send events to the client.
     */
    async *reader(): AsyncIterableIterator<TelnetEvent> {
        for await (const chunk of iterateReader(this.socket)) {
            for (const ev of this.parser.receive(chunk)) {
                if (ev.type == EventType.Send) {
                    this.write(ev.buffer);
                    continue;
                } else {
                    yield ev;
                }
            }
        }
    }
}
