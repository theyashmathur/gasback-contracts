// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract GasBack is Initializable, UUPSUpgradeable, AccessControlUpgradeable {
    mapping (bytes32 => bool) public isRootSubmitted;
    mapping (bytes32 => mapping (bytes32 => bool)) public isLeafClaimed;
    mapping (bytes32 => uint256) public rootTotalAmount;
    mapping (bytes32 => uint256) public rootRemainingAmount;

    event RootSubmitted(bytes32 indexed root, uint256 indexed value);
    event Claimed(address indexed account, bytes32 indexed root, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public virtual initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function submitRoot(bytes32[] memory _root) public payable onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < _root.length; ++i) {
            require(!isRootSubmitted[_root[i]], "root already submitted");

            isRootSubmitted[_root[i]] = true;
            rootTotalAmount[_root[i]] = msg.value;
            rootRemainingAmount[_root[i]] = msg.value;

            emit RootSubmitted(_root[i], msg.value);
        }
    }

    function claim(bytes32[] memory _root, bytes32[][] memory _proof, uint256[] memory _amount) public {
        require(_root.length == _amount.length && _proof.length == _amount.length);
        
        for (uint256 i = 0; i < _root.length; ++i) {
            require(isRootSubmitted[_root[i]], "root does not exist");
            
            bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, _amount[i])))); // maybe we will need tx hash or block id because there may be transactions with the same amount

            require(!isLeafClaimed[_root[i]][leaf], "leaf already claimed");
            require(_amount[i] <= rootRemainingAmount[_root[i]], "not enough funds to cover this proof");
            require(MerkleProof.verify(_proof[i], _root[i], leaf), "Invalid proof");

            isLeafClaimed[_root[i]][leaf] = true;
            rootRemainingAmount[_root[i]] -= _amount[i];

            (bool payment, ) = msg.sender.call{value: _amount[i]}("");
            require(payment, "Failed to send payment");

            emit Claimed(msg.sender, _root[i], _amount[i]);
        }
    }

    function _authorizeUpgrade(address ) internal virtual override {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Account does not have Admin role");
    }
}