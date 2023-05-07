import { iterateReader } from "std/streams/iterate_reader.ts";
import {
    EventType,
    TelnetEvent,
    TelnetParser,
} from "https://deno.land/x/denotel@0.1.6/mod.ts";

export class TelnetClient {
    public readonly uuid: string = crypto.randomUUID();
    public readonly parser: TelnetParser = new TelnetParser();
    constructor(public readonly socket: Deno.Conn) {}
    async write(chunk: Uint8Array): Promise<number> {
        return await this.socket.write(chunk);
    }
    async send(data: string): Promise<number> {
        return await this.write(this.parser.send(data));
    }
    close(): void {
        this.socket.close();
    }
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
