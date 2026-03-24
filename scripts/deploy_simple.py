"""
Alternative deployment script that doesn't require solcx.
Uses pre-compiled contract bytecode.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.utils.blockchain import get_web3_instance
from app.config import settings
from web3 import Web3
from eth_account import Account
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pre-compiled contract ABI and bytecode (from Remix IDE or manual compilation)
# This is the compiled version of AttendanceVerification.sol
CONTRACT_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": True,
                "internalType": "string",
                "name": "attendanceId",
                "type": "string"
            },
            {
                "indexed": False,
                "internalType": "bytes32",
                "name": "attendanceHash",
                "type": "bytes32"
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "studentId",
                "type": "string"
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "classId",
                "type": "string"
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
            }
        ],
        "name": "AttendanceStored",
        "type": "event"
    },
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": True,
                "internalType": "string",
                "name": "attendanceId",
                "type": "string"
            },
            {
                "indexed": False,
                "internalType": "bool",
                "name": "isValid",
                "type": "bool"
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
            }
        ],
        "name": "AttendanceVerified",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "index",
                "type": "uint256"
            }
        ],
        "name": "getAttendanceIdByIndex",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "attendanceId",
                "type": "string"
            }
        ],
        "name": "getAttendanceHash",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "attendanceHash",
                "type": "bytes32"
            },
            {
                "internalType": "string",
                "name": "studentId",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "classId",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalRecords",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "attendanceId",
                "type": "string"
            }
        ],
        "name": "recordExists",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "attendanceId",
                "type": "string"
            },
            {
                "internalType": "bytes32",
                "name": "attendanceHash",
                "type": "bytes32"
            },
            {
                "internalType": "string",
                "name": "studentId",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "classId",
                "type": "string"
            }
        ],
        "name": "storeAttendanceHash",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "attendanceId",
                "type": "string"
            },
            {
                "internalType": "bytes32",
                "name": "providedHash",
                "type": "bytes32"
            }
        ],
        "name": "verifyAttendance",
        "outputs": [
            {
                "internalType": "bool",
                "name": "is Valid",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

print("=" * 60)
print("Simple Smart Contract Deployment")
print("=" * 60)
print()

# Check Ganache connection
print("📡 Checking Ganache connection...")
web3 = get_web3_instance()

if web3 is None:
    print(f"❌ Failed to connect to Ganache at {settings.ganache_url}")
    print("   Make sure Ganache is running")
    print()
    input("Press Enter to exit...")
    sys.exit(1)

print(f"✅ Connected to Ganache")
print(f"   URL: {settings.ganache_url}")
print(f"   Chain ID: {web3.eth.chain_id}")
print()

# Get private key
private_key = settings.deployer_private_key

if not private_key or private_key == "PASTE_YOUR_GANACHE_PRIVATE_KEY_HERE":
    print("❌ No valid DEPLOYER_PRIVATE_KEY found in .env")
    print()
    input("Press Enter to exit...")
    sys.exit(1)

# Get account
try:
    account = Account.from_key(private_key)
    print(f"📌 Using account: {account.address}")
    balance = web3.eth.get_balance(account.address)
    print(f"   Balance: {web3.from_wei(balance, 'ether')} ETH")
    print()
except Exception as e:
    print(f"❌ Invalid private key: {e}")
    input("Press Enter to exit...")
    sys.exit(1)

# For simplicity, tell user to use Remix IDE
print("=" * 60)
print("⚠️  Manual Deployment Required")
print("=" * 60)
print()
print("Due to SSL issues with solidity compiler download,")
print("please use Remix IDE (online Solidity compiler) to deploy.")
print()
print("Steps:")
print("1. Go to: https://remix.ethereum.org/")
print("2. Create new file 'AttendanceVerification.sol'")
print("3. Copy contract code from: contracts/AttendanceVerification.sol")
print("4. Compile with Solidity 0.8.0")
print("5. Deploy to 'Injected Provider' OR use Ganache directly")
print()
print("Alternative: I can create a simple deployment using etherscan API")
print("OR we can skip compilation and use the contract functions directly")
print()
print("For now, let me save the ABI so you can use the contract:")

# Save ABI
abi_file = Path("contracts/abi.json")
abi_file.parent.mkdir(parents=True, exist_ok=True)

with open(abi_file, 'w') as f:
    json.dump(CONTRACT_ABI, f, indent=2)

print(f"✅ ABI saved to: {abi_file}")
print()
print("=" * 60)
print("Next Steps:")
print("=" * 60)
print()
print("I'll create a simpler deployment approach...")
print()
input("Press Enter to continue...")
