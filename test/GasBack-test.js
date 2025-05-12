const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const exp = require("constants");
const { stringify } = require("querystring");

describe("GasBack", function () {
    let GasBack;
    let gasBack;

    let owner;
    let alice;
    let badActor;

    before(async function() {
        [owner, alice, badActor] = await ethers.getSigners();
        
        console.log("Owner:", owner.address);
        console.log("Alice:", alice.address);
        console.log("Bad actor:", badActor.address);

        GasBack = await ethers.getContractFactory("GasBack");
    });

    beforeEach(async function() {
        gasBack = await upgrades.deployProxy(GasBack, [], {initializer: "initialize"});
        await gasBack.waitForDeployment();
    });

    it("Should allow admin to submit root", async function() {
        let values = [];
        let totalAmount = 0n;
        const amount = ethers.parseEther("1");

        for (let i = 0; i < 10; ++i) {
            values.push([alice.address, amount.toString()]);
            totalAmount += amount;
        }

        const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
        const tx = await gasBack.submitRoot([tree.root], {value: totalAmount});

        expect(tx).to.emit(gasBack, "RootSubmitted").withArgs(
            tree.root,
            totalAmount
        );
        expect(await gasBack.isRootSubmitted(tree.root)).to.equal(true);
        expect(await gasBack.rootTotalAmount(tree.root)).to.equal(totalAmount);
        expect(await gasBack.rootRemainingAmount(tree.root)).to.equal(totalAmount);
    });

    it("Should not allow non-admin to submit root", async function() {
        let values = [];
        let totalAmount = 0n;
        const amount = ethers.parseEther("1");

        for (let i = 0; i < 10; ++i) {
            values.push([alice.address, amount.toString()]);
            totalAmount += amount;
        }

        const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
        await expect(gasBack.connect(badActor).submitRoot([tree.root], {value: totalAmount})).to.be.reverted;
    });

    it("Should allow to claim gas", async function() {
        let values = [];
        let totalAmount = 0n;
        const amount = ethers.parseEther("1");

        for (let i = 0; i < 10; ++i) {
            values.push([alice.address, amount.toString()]);
            totalAmount += amount;
        }

        const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
        await gasBack.submitRoot([tree.root], {value: totalAmount});

        const proof = tree.getProof(0);
        const tx = await gasBack.connect(alice).claim([tree.root], [proof], [amount]);

        expect(tx).to.emit(gasBack, "Claimed").withArgs(
            alice.address,
            tree.root,
            amount
        );
        expect(await gasBack.rootRemainingAmount(tree.root)).to.equal(totalAmount - amount);
    });

    it("Should not allow to claim if root is not submitted", async function() {
        let values = [];
        let totalAmount = 0n;
        const amount = ethers.parseEther("1");

        for (let i = 0; i < 10; ++i) {
            values.push([alice.address, amount.toString()]);
            totalAmount += amount;
        }

        const tree = StandardMerkleTree.of(values, ["address", "uint256"]);

        const proof = tree.getProof(0);
        await expect(gasBack.connect(alice).claim([tree.root], [proof], [amount])).to.be.revertedWith("root does not exist");
    });

    it("Should not allow to claim leaf is already claimed", async function() {
        let values = [];
        let totalAmount = 0n;
        const amount = ethers.parseEther("1");

        for (let i = 0; i < 10; ++i) {
            values.push([alice.address, amount.toString()]);
            totalAmount += amount;
        }

        const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
        await gasBack.submitRoot([tree.root], {value: totalAmount});

        const proof = tree.getProof(0);
        await gasBack.connect(alice).claim([tree.root], [proof], [amount]);

        await expect(gasBack.connect(alice).claim([tree.root], [proof], [amount])).to.be.revertedWith("leaf already claimed");
    });

    it("Should not allow to claim if the root does not have enough funds", async function() {
        let values = [];
        let totalAmount = 0n;
        const amount = ethers.parseEther("1");

        for (let i = 0; i < 10; ++i) {
            values.push([alice.address, amount.toString()]);
            totalAmount += amount;
        }

        const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
        await gasBack.submitRoot([tree.root]);

        const proof = tree.getProof(0);
        await expect(gasBack.connect(alice).claim([tree.root], [proof], [amount])).to.be.revertedWith(
            "not enough funds to cover this proof"
        );
    });

    it("Should not allow to claim if proof is not valid", async function() {
        let values = [];
        let totalAmount = 0n;
        const amount = ethers.parseEther("1");

        for (let i = 0; i < 10; ++i) {
            values.push([alice.address, amount.toString()]);
            totalAmount += amount;
        }

        const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
        await gasBack.submitRoot([tree.root], {value: totalAmount});

        const otherValues = [[badActor.address, amount.toString()]];
        const otherTree = StandardMerkleTree.of(otherValues, ["address", "uint256"]);

        const proof = otherTree.getProof(0);
        await expect(gasBack.connect(alice).claim([tree.root], [proof], [amount])).to.be.revertedWith("Invalid proof");
    });

    describe("Gas consumption test", function() {
        it("First, Middle and Last, 10 leafs", async function() {
            let values = [];
            let totalAmount = 0n;
            let amounts = [];
    
            for (let i = 0; i < 10; ++i) {
                const amount = ethers.parseEther((Math.random() + 1).toString());
                values.push([alice.address, amount]);
                amounts.push(amount);
                totalAmount += amount;
            }
    
            const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
            await gasBack.submitRoot([tree.root], {value: totalAmount});
    
            const proof0 = tree.getProof(0);
            const tx0 = await gasBack.connect(alice).claim([tree.root], [proof0], [amounts[0]]);
            console.log("Gas Leaf first:", (await tx0.wait()).gasUsed);
    
            const proof1 = tree.getProof(4);
            const tx1 = await gasBack.connect(alice).claim([tree.root], [proof1], [amounts[4]]);
            console.log("Gas Leaf middle:", (await tx1.wait()).gasUsed);
    
            const proof2 = tree.getProof(9);
            const tx2 = await gasBack.connect(alice).claim([tree.root], [proof2], [amounts[9]]);
            console.log("Gas Leaf last:", (await tx2.wait()).gasUsed);
        });

        it("32 leafs", async function() {
            let values = [];
            let totalAmount = 0n;
            let amounts = [];
    
            for (let i = 0; i < 32; ++i) {
                const amount = ethers.parseEther((Math.random() + 1).toString());
                values.push([alice.address, amount]);
                amounts.push(amount);
                totalAmount += amount;
            }
    
            const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
            await gasBack.submitRoot([tree.root], {value: totalAmount});
    
            const proof0 = tree.getProof(0);
            const tx0 = await gasBack.connect(alice).claim([tree.root], [proof0], [amounts[0]]);
            console.log("Gas Leaf first:", (await tx0.wait()).gasUsed);
    
            const proof1 = tree.getProof(15);
            const tx1 = await gasBack.connect(alice).claim([tree.root], [proof1], [amounts[15]]);
            console.log("Gas Leaf middle:", (await tx1.wait()).gasUsed);
    
            const proof2 = tree.getProof(31);
            const tx2 = await gasBack.connect(alice).claim([tree.root], [proof2], [amounts[31]]);
            console.log("Gas Leaf last:", (await tx2.wait()).gasUsed);
        });

        it("512 leafs", async function() {
            let values = [];
            let totalAmount = 0n;
            let amounts = [];
    
            for (let i = 0; i < 512; ++i) {
                const amount = ethers.parseEther((Math.random() + 1).toString());
                values.push([alice.address, amount]);
                amounts.push(amount);
                totalAmount += amount;
            }
    
            const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
            await gasBack.submitRoot([tree.root], {value: totalAmount});
    
            const proof0 = tree.getProof(0);
            const tx0 = await gasBack.connect(alice).claim([tree.root], [proof0], [amounts[0]]);
            console.log("Gas Leaf first:", (await tx0.wait()).gasUsed);
    
            const proof1 = tree.getProof(255);
            const tx1 = await gasBack.connect(alice).claim([tree.root], [proof1], [amounts[255]]);
            console.log("Gas Leaf middle:", (await tx1.wait()).gasUsed);
    
            const proof2 = tree.getProof(511);
            const tx2 = await gasBack.connect(alice).claim([tree.root], [proof2], [amounts[511]]);
            console.log("Gas Leaf last:", (await tx2.wait()).gasUsed);
        });
    });
});