// Deploy do AnchorRegistry.sol na Base Sepolia (compila com solc + ethers).
import "dotenv/config";
import fs from "fs";
import solc from "solc";
import { JsonRpcProvider, Wallet, ContractFactory, formatEther } from "ethers";

const source = fs.readFileSync("../contracts/AnchorRegistry.sol", "utf8");
const input = {
  language: "Solidity",
  sources: { "AnchorRegistry.sol": { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (out.errors ?? []).filter((e) => e.severity === "error");
if (errs.length) {
  console.error("Erros de compilação:", errs.map((e) => e.formattedMessage).join("\n"));
  process.exit(1);
}
const c = out.contracts["AnchorRegistry.sol"].AnchorRegistry;
console.log("compilado ✅ (bytecode", c.evm.bytecode.object.length / 2, "bytes)");

const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
const wallet = new Wallet(process.env.ANCHOR_PRIVATE_KEY, provider);
console.log("deployer:", wallet.address, "| saldo:", formatEther(await provider.getBalance(wallet.address)), "ETH");

const factory = new ContractFactory(c.abi, c.evm.bytecode.object, wallet);
const contract = await factory.deploy();
const tx = contract.deploymentTransaction();
console.log("tx de deploy:", tx.hash);
await contract.waitForDeployment();
const addr = await contract.getAddress();
console.log("DEPLOYED=" + addr);
console.log("explorer: https://sepolia.basescan.org/address/" + addr);
