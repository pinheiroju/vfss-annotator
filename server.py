"""Servidor local para o VFSS Annotator.
FFmpeg.wasm exige SharedArrayBuffer, que requer os headers COOP/COEP."""

import http.server
import socketserver

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # silencia logs

with socketserver.TCPServer(('', PORT), Handler) as httpd:
    print(f'Servidor rodando em http://localhost:{PORT}')
    print('Abra o link acima no navegador. Pressione Ctrl+C para parar.')
    httpd.serve_forever()
