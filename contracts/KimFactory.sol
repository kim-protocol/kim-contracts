// SPDX-License-Identifier: MIT
pragma solidity ^0.6.5;

import "./interfaces/IFeeSharing.sol";
import "./interfaces/IKimFactory.sol";
import "./KimPair.sol";

contract KimFactory is IKimFactory {
    address public override owner;
    address public override feePercentOwner;
    address public override setStableOwner;
    address public override feeTo;

    //uint public constant FEE_DENOMINATOR = 100000;
    uint public constant OWNER_FEE_SHARE_MAX = 100000; // 100%
    uint public override ownerFeeShare = 50000; // default value = 50%

    uint public constant REFERER_FEE_SHARE_MAX = 20000; // 20%
    mapping(address => uint) public override referrersFeeShare; // fees are taken from the user input

    mapping(address => mapping(address => address)) public override getPair;
    address[] public override allPairs;

    event FeeToTransferred(address indexed prevFeeTo, address indexed newFeeTo);
    event OwnerFeeShareUpdated(uint prevOwnerFeeShare, uint ownerFeeShare);
    event OwnershipTransferred(
        address indexed prevOwner,
        address indexed newOwner
    );
    event FeePercentOwnershipTransferred(
        address indexed prevOwner,
        address indexed newOwner
    );
    event SetStableOwnershipTransferred(
        address indexed prevOwner,
        address indexed newOwner
    );
    event ReferrerFeeShareUpdated(
        address referrer,
        uint prevReferrerFeeShare,
        uint referrerFeeShare
    );

    constructor(address feeTo_) public {
        owner = msg.sender;
        feePercentOwner = msg.sender;
        setStableOwner = msg.sender;
        feeTo = feeTo_;

        emit OwnershipTransferred(address(0), msg.sender);
        emit FeePercentOwnershipTransferred(address(0), msg.sender);
        emit SetStableOwnershipTransferred(address(0), msg.sender);
        emit FeeToTransferred(address(0), feeTo_);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner == msg.sender, "KimFactory: caller is not the owner");
        _;
    }

    function allPairsLength() external view override returns (uint) {
        return allPairs.length;
    }

    function createPair(
        address tokenA,
        address tokenB
    ) external override returns (address pair) {
        require(tokenA != tokenB, "KimFactory: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        require(token0 != address(0), "KimFactory: ZERO_ADDRESS");
        require(
            getPair[token0][token1] == address(0),
            "KimFactory: PAIR_EXISTS"
        ); // single check is sufficient
        bytes memory bytecode = type(KimPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        require(pair != address(0), "KimFactory: FAILED");
        KimPair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setOwner(address _owner) external onlyOwner {
        require(_owner != address(0), "KimFactory: zero address");
        emit OwnershipTransferred(owner, _owner);
        owner = _owner;
    }

    function setFeePercentOwner(address _feePercentOwner) external onlyOwner {
        require(_feePercentOwner != address(0), "KimFactory: zero address");
        emit FeePercentOwnershipTransferred(feePercentOwner, _feePercentOwner);
        feePercentOwner = _feePercentOwner;
    }

    function setSetStableOwner(address _setStableOwner) external {
        require(msg.sender == setStableOwner, "KimFactory: not setStableOwner");
        require(_setStableOwner != address(0), "KimFactory: zero address");
        emit SetStableOwnershipTransferred(setStableOwner, _setStableOwner);
        setStableOwner = _setStableOwner;
    }

    function setFeeTo(address _feeTo) external override onlyOwner {
        emit FeeToTransferred(feeTo, _feeTo);
        feeTo = _feeTo;
    }

    /**
     * @dev Updates the share of fees attributed to the owner
     *
     * Must only be called by owner
     */
    function setOwnerFeeShare(uint newOwnerFeeShare) external onlyOwner {
        require(
            newOwnerFeeShare > 0,
            "KimFactory: ownerFeeShare mustn't exceed minimum"
        );
        require(
            newOwnerFeeShare <= OWNER_FEE_SHARE_MAX,
            "KimFactory: ownerFeeShare mustn't exceed maximum"
        );
        emit OwnerFeeShareUpdated(ownerFeeShare, newOwnerFeeShare);
        ownerFeeShare = newOwnerFeeShare;
    }

    /**
     * @dev Updates the share of fees attributed to the given referrer when a swap went through him
     *
     * Must only be called by owner
     */
    function setReferrerFeeShare(
        address referrer,
        uint referrerFeeShare
    ) external onlyOwner {
        require(referrer != address(0), "KimFactory: zero address");
        require(
            referrerFeeShare <= REFERER_FEE_SHARE_MAX,
            "KimFactory: referrerFeeShare mustn't exceed maximum"
        );
        emit ReferrerFeeShareUpdated(
            referrer,
            referrersFeeShare[referrer],
            referrerFeeShare
        );
        referrersFeeShare[referrer] = referrerFeeShare;
    }

    /// @notice Register contract to earn fees.
    /// @param feeSharingContract fee sharing smart contract address
    /// @param recipient recipient of the ownership NFT
    /// @return tokenId of the ownership NFT that collects fees
    function register(
        address feeSharingContract,
        address recipient
    ) external onlyOwner returns (uint256 tokenId) {
        (tokenId) = IFeeSharing(feeSharingContract).register(recipient);
    }

    /// @notice Assigns smart contract to an existing NFT to earn fees.
    /// @param feeSharingContract fee sharing smart contract address
    /// @param tokenId tokenId which will collect fees
    /// @return tokenId of the ownership NFT that collects fees
    function assign(
        address feeSharingContract,
        uint256 tokenId
    ) external onlyOwner returns (uint256) {
        return IFeeSharing(feeSharingContract).assign(tokenId);
    }

    /// @notice Withdraws earned fees to `_recipient` address.
    /// @param feeSharingContract fee sharing smart contract address
    /// @param tokenId token Id
    /// @param recipient recipient of fees
    /// @param amount amount of fees to withdraw
    /// @return amount of fees withdrawn
    function withdraw(
        address feeSharingContract,
        uint256 tokenId,
        address payable recipient,
        uint256 amount
    ) external onlyOwner returns (uint256) {
        // bytes4(keccak256(bytes('withdraw(uint256, address, uint256)')));
        (bool success, bytes memory data) = feeSharingContract.call(
            abi.encodeWithSelector(0xe63697c8, tokenId, recipient, amount)
        );

        require(success, "KimFactory::withdraw: withdraw failed");

        return abi.decode(data, (uint256));
    }

    function feeInfo()
        external
        view
        override
        returns (uint _ownerFeeShare, address _feeTo)
    {
        _ownerFeeShare = ownerFeeShare;
        _feeTo = feeTo;
    }
}
