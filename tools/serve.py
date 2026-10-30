#!/usr/bin/env python3
"""Static file server for local development and the browser tests.

Serves a directory over real HTTP (the emulator fetches its program and ROM with
XMLHttpRequest, which does not work from file://).

    uv run --no-project python tools/serve.py --dir public --port 8765
    uv run --no-project python tools/serve.py --dir public --port 8765 --also-under zx81-trainer

--also-under PREFIX additionally serves the same directory below /PREFIX/, which is how a
GitHub Pages project site is laid out (https://USER.github.io/REPOSITORY/). Opening
http://localhost:PORT/PREFIX/ catches root-relative asset paths. Default port 8765.
"""

import argparse
import functools
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from typing import ClassVar


class Handler(SimpleHTTPRequestHandler):
    extensions_map: ClassVar[dict[str, str]] = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".hex": "text/plain",
        ".rom": "application/octet-stream",
    }

    prefix = None  # set by main()

    def translate_path(self, path):
        if self.prefix:
            marker = "/" + self.prefix
            if path == marker:
                path = marker + "/"
            if path.startswith(marker + "/"):
                path = path[len(marker) :]
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        pass


class Server(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        # a browser that navigates away aborts its running downloads; that is not an error here
        if issubclass(sys.exc_info()[0], ConnectionError):
            return
        super().handle_error(request, client_address)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--dir", default="public")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--also-under", dest="prefix", default=None)
    args = parser.parse_args()

    Handler.prefix = args.prefix.strip("/") if args.prefix else None
    handler = functools.partial(Handler, directory=args.dir)
    with Server(("127.0.0.1", args.port), handler) as server:
        print(f"serving {args.dir} on http://localhost:{args.port}/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
