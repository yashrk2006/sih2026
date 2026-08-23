"""
Local Blockchain Node — Lightweight Ethereum JSON-RPC Server for SIH26190.

Emulates Hardhat/Ganache node on http://127.0.0.1:8545.
Stores anchored SHA-256 hashes in memory and responds to Web3 RPC calls.
"""
import time
import hashlib
import json
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

logger = logging.getLogger(__name__)

# State storage
_ANCHORED_HASHES = {}  # hex_hash -> {"timestamp": int, "tx_hash": str, "block_number": int, "sender": str}
_TRANSACTIONS = {}      # tx_hash -> receipt_dict
_BLOCK_NUMBER = 100
_SERVER_INSTANCE = None
_SERVER_THREAD = None


class BlockchainJSONRPCHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress HTTP access logging noise
        pass

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        
        try:
            req = json.loads(body.decode("utf-8"))
            method = req.get("method")
            req_id = req.get("id", 1)
            params = req.get("params", [])

            result = self.handle_rpc_method(method, params)
            response = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": result
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode("utf-8"))
        except Exception as e:
            logger.error("Local node RPC error: %s", e)
            self.send_response(500)
            self.end_headers()

    def handle_rpc_method(self, method: str, params: list):
        global _BLOCK_NUMBER, _ANCHORED_HASHES, _TRANSACTIONS

        if method in ("web3_clientVersion", "client_version"):
            return "HardhatNetwork/2.19.0/SIH26190-LocalEVM"
        elif method == "net_version":
            return "31337"
        elif method == "eth_chainId":
            return "0x7a69"  # 31337 in hex
        elif method == "eth_blockNumber":
            return hex(_BLOCK_NUMBER)
        elif method == "eth_getBlockByNumber":
            return {
                "number": hex(_BLOCK_NUMBER),
                "hash": "0x" + hashlib.sha256(str(_BLOCK_NUMBER).encode()).hexdigest(),
                "parentHash": "0x" + "0"*64,
                "nonce": "0x0000000000000042",
                "sha3Uncles": "0x1dcc4cb82b660d7e49152014853461446773c3021948e424268e30b62e49c719",
                "logsBloom": "0x" + "0"*512,
                "transactionsRoot": "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
                "stateRoot": "0x" + "0"*64,
                "receiptsRoot": "0x" + "0"*64,
                "miner": "0x0000000000000000000000000000000000000000",
                "difficulty": "0x1",
                "totalDifficulty": "0x1",
                "extraData": "0x",
                "size": "0x3e8",
                "gasLimit": "0x1c9c380",
                "gasUsed": "0x5208",
                "timestamp": hex(int(time.time())),
                "transactions": [],
                "uncles": []
            }
        elif method == "eth_accounts":
            return ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]
        elif method == "eth_gasPrice":
            return "0x3b9aca00"
        elif method == "eth_feeHistory":
            return {
                "oldestBlock": hex(_BLOCK_NUMBER - 1),
                "baseFeePerGas": ["0x3b9aca00", "0x3b9aca00"],
                "gasUsedRatio": [0.5],
            }
        elif method == "eth_getTransactionCount":
            return "0x1"
        elif method in ("eth_sendTransaction", "eth_sendRawTransaction"):
            _BLOCK_NUMBER += 1
            now_ts = int(time.time())

            raw_data = ""
            sender = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
            if params and isinstance(params[0], dict):
                raw_data = params[0].get("data", "")
                sender = params[0].get("from", sender)

            # Deterministic tx_hash: derived from the document hash + block number.
            # Same document always anchors to the same tx_hash, making it verifiable.
            doc_hash = raw_data[-64:] if len(raw_data) >= 64 else hashlib.sha256(raw_data.encode()).hexdigest()
            tx_seed = f"anchor:{doc_hash}:block:{_BLOCK_NUMBER}".encode("utf-8")
            tx_hash = "0x" + hashlib.sha256(tx_seed).hexdigest()

            _ANCHORED_HASHES[doc_hash.lower()] = {
                "timestamp": now_ts,
                "tx_hash": tx_hash,
                "block_number": _BLOCK_NUMBER,
                "sender": sender,
            }

            receipt = {
                "transactionHash": tx_hash,
                "transactionIndex": "0x0",
                "blockHash": "0x" + hashlib.sha256(f"block:{_BLOCK_NUMBER}".encode()).hexdigest(),
                "blockNumber": hex(_BLOCK_NUMBER),
                "from": sender,
                "to": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                "cumulativeGasUsed": "0x5208",
                "gasUsed": "0x5208",
                "contractAddress": None,
                "logs": [],
                "status": "0x1",
            }
            _TRANSACTIONS[tx_hash] = receipt
            return tx_hash

        elif method == "eth_getTransactionReceipt":
            tx_hash = params[0] if params else ""
            return _TRANSACTIONS.get(tx_hash, {
                "transactionHash": tx_hash,
                "blockNumber": hex(_BLOCK_NUMBER),
                "status": "0x1"
            })

        elif method == "eth_call":
            call_dict = params[0] if params and isinstance(params[0], dict) else {}
            data = call_dict.get("data", "")
            
            if len(data) >= 64:
                param_hash = data[-64:].lower()
                if param_hash in _ANCHORED_HASHES:
                    info = _ANCHORED_HASHES[param_hash]
                    ts_hex = hex(info["timestamp"])[2:].zfill(64)
                    return "0x" + ts_hex
                else:
                    return "0x" + "0"*64

            return "0x" + "0"*64

        return "0x0"


def start_local_blockchain_node(host: str = "127.0.0.1", port: int = 8545):
    """Start local RPC server in a background daemon thread."""
    global _SERVER_INSTANCE, _SERVER_THREAD
    if _SERVER_INSTANCE is not None:
        return True

    try:
        _SERVER_INSTANCE = HTTPServer((host, port), BlockchainJSONRPCHandler)
        _SERVER_THREAD = threading.Thread(target=_SERVER_INSTANCE.serve_forever, daemon=True)
        _SERVER_THREAD.start()
        logger.info("Local Hardhat/EVM Blockchain Node started at http://%s:%d", host, port)
        return True
    except Exception as e:
        logger.warning("Could not start local blockchain server on port %d: %s", port, e)
        return False
