// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract CustomToken is ERC20, AccessControl {
	bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
	bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
	bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    mapping(address => bool) public blockList;
    
    event BlockListUpdated(address indexed user, bool value);

    /**
      * @notice CustomToken is simple contract to show examples how to use hardhat: tests, deploys, tasks etc.
      * @dev CustomToken is ERC20 which mint tokens when you deploy this contract
      * @param _name is name of the ERC20 token
      * @param _symbol is symbol of the ERC20 token
      */
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
        _setupRole(BURNER_ROLE, msg.sender);
        _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(BURNER_ROLE, ADMIN_ROLE);
    }

    /**
    * @notice minting new tokens
    * @dev minting to the address {to} and amount {amount}
    * @param to new tokens reciever address 
    * @param amount new tokens amount 
     */
	function mint(address to, uint256 amount) external {
        require(
            hasRole(MINTER_ROLE, msg.sender),
            "You should have a minter role"
        );
        _mint(to, amount);
    }

    /**
    * @notice burn tokens
    * @dev burn tokens of the address {from} in the amount {amount}
    * @param from tokens owner address 
    * @param amount tokens amount 
     */
    function burn(address from, uint256 amount) external {
        require(
            hasRole(BURNER_ROLE, msg.sender),
            "You should have a burner role"
        );
        _burn(from, amount);
    }

    /**
    * @notice block list update - update users/contracts blocking addresses status
    * @param user address of the user/contract 
    * @param value status state; true => block; false => unblock
     */
    function blockListUpdate(address user, bool value) public virtual {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "You should have an admin role"
        );
        blockList[user] = value;
        emit BlockListUpdated(user, value);
    }
    
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override(ERC20) {
        require (!blockList[from], "Token transfer refused. Sender is in the block list");
        require (!blockList[to], "Token transfer refused. Receiver is in the block list");
        super._beforeTokenTransfer(from, to, amount);
    }
}
