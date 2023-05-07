import { TelnetClient } from "./client.ts";
import { EventEmitter as EE } from "https://deno.land/x/ee_ts@1.0.0/mod.ts";
import {
    EventType,
    Option,
    TelnetEventSubnegotiation,
} from "https://deno.land/x/denotel@0.1.6/mod.ts";

interface Events {
    connect(client: TelnetClient): void;
    text(client: TelnetClient, data: string): void;
    subnegotiation(
        client: TelnetClient,
        option: number,
        payload: Uint8Array,
    ): void;
    gmcp(
        client: TelnetClient,
        namespace: string,
        // deno-lint-ignore no-explicit-any
        payload: { [key: string]: any } | string[] | string,
    ): void;
    disconnect(client: TelnetClient): void;
    error(err: Error): void;
    close(): void;
}

type ServerOptions = {
    host?: string;
    port: number;
};

export class TelnetServer extends EE<Events> {
    private listener: Deno.Listener;
    public readonly host: string;
    public readonly port: number;
    private clients: Map<string, TelnetClient> = new Map();
    private _isClosing = false;
    constructor(opts: ServerOptions) {
        super();
        this.host = opts.host || "127.0.0.1";
        this.port = opts.port;
        this.listener = Deno.listen({ hostname: this.host, port: this.port });
        this.listen();
    }
    async listen(): Promise<void> {
        try {
            for await (const conn of this.listener) {
                let client: TelnetClient | null = new TelnetClient(conn);
                this.clients.set(client.uuid, client);
                this.emit("connect", client);
                const parser = client.parser;
                parser.compatibility.getOption(Option.GMCP).local = true;
                const doGMCP = parser.will(Option.GMCP);
                if (doGMCP != null) client.write(doGMCP.buffer);
                try {
                    for await (const ev of client.reader()) {
                        if (ev.type == EventType.Normal) {
                            this.emit(
                                "text",
                                client,
                                (new TextDecoder()).decode(ev.buffer)
                                    .trim(),
                            );
                        } else if (ev.type == EventType.Subnegotation) {
                            const subneg = ev as TelnetEventSubnegotiation;
                            this.emit(
                                "subnegotiation",
                                client,
                                subneg.option,
                                subneg.data,
                            );
                            switch (subneg.option) {
                                case Option.GMCP: {
                                    const payload = (new TextDecoder())
                                        .decode(
                                            subneg.data,
                                        ).trim();
                                    const payload_split = payload.indexOf(
                                        " ",
                                    );
                                    if (payload_split == -1) {
                                        if (payload.length > 0) {
                                            this.emit(
                                                "gmcp",
                                                client,
                                                payload,
                                                "",
                                            );
                                        }
                                        break;
                                    }
                                    const namespace = payload.slice(
                                        0,
                                        payload_split,
                                    );
                                    const json = JSON.parse(payload.slice(
                                        payload_split + 1,
                                    ));
                                    this.emit(
                                        "gmcp",
                                        client,
                                        namespace,
                                        json,
                                    );
                                    break;
                                }
                            }
                        }
                    }
                } catch (cerr) {
                    // Ignore ECONNRESET and EINTR errors.
                    // These only happen when the connection suddenly gets lost or the server forcibly closes the client connection.
                    if (
                        cerr.code != undefined && cerr.code != "ECONNRESET" &&
                        cerr.code != "EINTR"
                    ) {
                        throw cerr;
                    }
                } finally {
                    if (!this._isClosing) this.emit("disconnect", client);
                    this.clients.delete(client.uuid);
                    client = null;
                }
            }
        } catch (err) {
            this.emit("error", err);
        } finally {
            this.emit("close");
        }
    }
    close(): void {
        this._isClosing = true;
        for (const client of this.clients.values()) {
            client.close();
        }
        this.listener.close();
    }
}
