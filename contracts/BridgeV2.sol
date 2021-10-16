// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "./CustomToken.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract BridgeV2 is Initializable, AccessControlUpgradeable, UUPSUpgradeable, PausableUpgradeable {

    enum SwapState {
        Empty,
        Swapped,
        Redeemed
    }

    enum TokenState {
        Inactive,
        Active
    }

    struct Swap {
        uint256 nonce;
        SwapState state;
    }

    struct TokenInfo {
        address tokenAddress;
        TokenState state;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public currentBridgeChainId;

    mapping(string => TokenInfo) public tokenBySymbol;
    mapping(uint256 => bool) public isChainActiveById;
    mapping(bytes32 => Swap) public swapByHash;
    string[] tokenSymbols;

    event SwapInitialized(
        uint256 initTimestamp,
        address indexed initiator,
        address recipient,
        uint256 amount,
        string symbol,
        uint256 chainFrom,
        uint256 chainTo,
        uint256 nonce
    );

    event SwapRedeemed(
        address indexed initiator,
        uint256 initTimestamp,
        uint256 nonce,
        uint256 amount,
        string symbol,
        uint256 chainFrom,
        uint256 chainTo
    );

    event TokenStateChanged(
        address indexed initiator,
        address tokenAddress,
        string symbol,
        TokenState newState
    );

    event ChainIdChanged(
        uint256 chainId,
        bool isActive
    );

    /**
    * @notice activate or disactivate network chain id from the chain list in this contract
    * @param bridgeChainId deployed network chain id
     */
    function initialize(uint256 bridgeChainId) initializer public {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(UPGRADER_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(VALIDATOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(UPGRADER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        
        currentBridgeChainId = bridgeChainId;
    }

    function _authorizeUpgrade(address newImplementation)
    internal
    onlyRole(UPGRADER_ROLE)
    override
    {}

    /**
    * @notice Pause the contract; whenever it will be upgraded
     */
    function pause() public {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "Bridge: You should have a pauser role"
        );
        _pause();
    }

    /**
    * @notice Unpause the contract; after upgration of the contract
     */
    function unpause() public {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "Bridge: You should have a pauser role"
        );
        _unpause();
    }

    /**
    * @notice activate or deactivate network chain id from the chain list in this contract
    * @param chainId network chain id
    * @param isActive bool; activate/deactivate
     */
    function updateChainById(uint256 chainId, bool isActive) external virtual {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "Bridge: You should have an admin role"
        );
        isChainActiveById[chainId] = isActive;

        emit ChainIdChanged(chainId, isActive);
    }

    /**
    * @notice provides list of registered tokens in this contract
     */
    function getTokenList() external view virtual returns (TokenInfo[] memory)  {
        TokenInfo[] memory tokens = new TokenInfo[](tokenSymbols.length);
        for (uint i = 0; i < tokenSymbols.length; i++) {
            tokens[i] = tokenBySymbol[tokenSymbols[i]];
        }
        return tokens;
    }

    /**
    * @notice add token to this contract in order to use them in swapping & redeeming
    * @param symbol of the token
    * @param tokenAddress token address
     */
    function addToken(string memory symbol, address tokenAddress) external virtual {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "Bridge: You should have an admin role"
        );
        tokenBySymbol[symbol] = TokenInfo({
            tokenAddress: tokenAddress,
            state: TokenState.Active
        });
        tokenSymbols.push(symbol);
    }

    /**
    * @notice deactivate tokens by symbol
    * @param symbol of the token
     */
    function deactivateTokenBySymbol(string memory symbol) external virtual {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "Bridge: You should have an admin role"
        );
        require(tokenSymbols.length > 0, "Bridge: There are no Tokens to deactivate") ;
        for (uint256 i; i < tokenSymbols.length; i++){
            if(keccak256(abi.encode(tokenSymbols[i])) == keccak256(abi.encode(symbol))) {
                tokenSymbols[i] = tokenSymbols[tokenSymbols.length-1];
                tokenSymbols.pop();
                break;
            }
        }
        TokenInfo storage token = tokenBySymbol[symbol];
        token.state = TokenState.Inactive;
        emit TokenStateChanged(msg.sender, token.tokenAddress, symbol, token.state);
    }

    /**
    * @notice activate tokens by symbol
    * @param symbol of the token
     */
    function activateTokenBySymbol(string memory symbol) external virtual {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "Bridge: You should have an admin role"
        );
        TokenInfo storage token = tokenBySymbol[symbol];
        token.state = TokenState.Active;
        tokenSymbols.push(symbol);
        emit TokenStateChanged(msg.sender, token.tokenAddress, symbol, token.state);
    }

    /**
    * @notice swap - produce tokens transaction to the other network bridge.
    * @param recipient address of the token's receiver
    * @param symbol of the sending tokens
    * @param amount of the sending tokens
    * @param chainTo network chain id of the token's receiver; cannot be the same network id
    * @param nonce unique number which should not repeat over all bridges among all networks
     */
    function swap(
        address recipient,
        string memory symbol,
        uint256 amount,
        uint256 chainTo,
        uint256 nonce
    ) external virtual whenNotPaused
    {
        require(
            chainTo != currentBridgeChainId,
            "Bridge: Invalid chainTo is same with current bridge chain"
        );
        require(
            isChainActiveById[chainTo],
            "Bridge: chainTo does not exist/is not active"
        );


        TokenInfo memory token = tokenBySymbol[symbol];
        require(
            token.state == TokenState.Active,
            "Bridge: Token is inactive"
        );
        
        bytes32 hash = keccak256(
            abi.encodePacked(
                recipient,
                amount,
                symbol,
                currentBridgeChainId, // ChainFrom
                chainTo,
                nonce
            )
        );

        require(
            swapByHash[hash].state == SwapState.Empty,
            "Bridge: Duplication of the transaction"
        );
        
        swapByHash[hash] = Swap({
        nonce: nonce,
        state: SwapState.Swapped
        });

        CustomToken(token.tokenAddress).burn(msg.sender, amount);

        emit SwapInitialized(
            block.timestamp,
            msg.sender,
            recipient,
            amount,
            symbol,
            currentBridgeChainId,
            chainTo,
            nonce
        );
    }

    /**
    * @notice redeem - provides tokens from transaction of other network's similar bridge.
    * @param symbol of the sending tokens
    * @param amount of the sending tokens
    * @param chainFrom network chain id of the token's sender; cannot be the same network id
    * @param nonce unique number which should not repeat over all bridges among all networks
    * @param v of the transaction sign
    * @param r of the transaction sign
    * @param s of the transaction sign
     */
    function redeem(
        string memory symbol,
        uint256 amount,
        uint256 chainFrom,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual whenNotPaused
    {
        TokenInfo memory token = tokenBySymbol[symbol];
        require(
            token.state == TokenState.Active,
            "Bridge: Token is inactive"
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                amount,
                symbol,
                chainFrom,
                currentBridgeChainId, //chainTo
                nonce
            )
        );

        require(
            swapByHash[hash].state == SwapState.Empty,
            "Bridge: Duplication of the transaction"
        );

        bytes32 hashedMessage = ECDSA.toEthSignedMessageHash(hash);
        address validatorAddress = ECDSA.recover(hashedMessage, v, r, s);
        
        require(
            hasRole(VALIDATOR_ROLE, validatorAddress),
            "Bridge: Validator address is not correct"
        );

        swapByHash[hash] = Swap({
            nonce: nonce,
            state: SwapState.Redeemed
        });

        CustomToken(token.tokenAddress).mint(msg.sender, amount);
        emit SwapRedeemed(
            msg.sender,
            block.timestamp,
            nonce,
            amount,
            symbol,
            chainFrom,
            currentBridgeChainId
        );
    }
}
