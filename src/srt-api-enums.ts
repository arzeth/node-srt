import { StrictExtract, } from 'ts-essentials';

export enum SRTSockOpt {
  SRTO_MSS = 0,             // the Maximum Transfer Unit
  SRTO_SNDSYN = 1,          // if sending is blocking
  SRTO_RCVSYN = 2,          // if receiving is blocking
  SRTO_ISN = 3,             // Initial Sequence Number (valid only after srt_connect or srt_accept-ed sockets)
  SRTO_FC = 4,              // Flight flag size (window size)
  SRTO_SNDBUF = 5,          // maximum buffer in sending queue
  SRTO_RCVBUF = 6,          // UDT receiving buffer size
  SRTO_LINGER = 7,          // waiting for unsent data when closing
  SRTO_UDP_SNDBUF = 8,      // UDP sending buffer size
  SRTO_UDP_RCVBUF = 9,      // UDP receiving buffer size
  // (some space left)
  SRTO_RENDEZVOUS = 12,     // rendezvous connection mode
  SRTO_SNDTIMEO = 13,       // send() timeout
  SRTO_RCVTIMEO = 14,       // recv() timeout
  SRTO_REUSEADDR = 15,      // reuse an existing port or create a new one
  SRTO_MAXBW = 16,          // maximum bandwidth (bytes per second) that the connection can use
  SRTO_STATE = 17,          // current socket state, see UDTSTATUS, read only
  SRTO_EVENT = 18,          // current available events associated with the socket
  SRTO_SNDDATA = 19,        // size of data in the sending buffer
  SRTO_RCVDATA = 20,        // size of data available for recv
  SRTO_SENDER = 21,         // Sender mode (independent of conn mode), for encryption, tsbpd handshake.
  SRTO_TSBPDMODE = 22,      // Enable/Disable TsbPd. Enable -> Tx set origin timestamp, Rx deliver packet at origin time + delay
  SRTO_LATENCY = 23,        // NOT RECOMMENDED. SET: to both SRTO_RCVLATENCY and SRTO_PEERLATENCY. GET: same as SRTO_RCVLATENCY.
  SRTO_INPUTBW = 24,        // Estimated input stream rate.
  SRTO_OHEADBW,             // MaxBW ceiling based on % over input stream rate. Applies when UDT_MAXBW=0 (auto).
  SRTO_PASSPHRASE = 26,     // Crypto PBKDF2 Passphrase (must be 10..79 characters, or empty to disable encryption)
  SRTO_PBKEYLEN,            // Crypto key len in bytes {16,24,32} Default: 16 (AES-128)
  SRTO_KMSTATE,             // Key Material exchange status (UDT_SRTKmState)
  SRTO_IPTTL = 29,          // IP Time To Live (passthru for system sockopt IPPROTO_IP/IP_TTL)
  SRTO_IPTOS,               // IP Type of Service (passthru for system sockopt IPPROTO_IP/IP_TOS)
  SRTO_TLPKTDROP = 31,      // Enable receiver pkt drop
  SRTO_SNDDROPDELAY = 32,   // Extra delay towards latency for sender TLPKTDROP decision (-1 to off)
  SRTO_NAKREPORT = 33,      // Enable receiver to send periodic NAK reports
  SRTO_VERSION = 34,        // Local SRT Version
  SRTO_PEERVERSION,         // Peer SRT Version (from SRT Handshake)
  SRTO_CONNTIMEO = 36,      // Connect timeout in msec. Caller default: 3000, rendezvous (x 10)
  SRTO_DRIFTTRACER = 37,    // Enable or disable drift tracer
  SRTO_MININPUTBW = 38,     // Minimum estimate of input stream rate.
   // (some space left)
  SRTO_SNDKMSTATE = 40,     // (GET) the current state of the encryption at the peer side
  SRTO_RCVKMSTATE,          // (GET) the current state of the encryption at the agent side
  SRTO_LOSSMAXTTL,          // Maximum possible packet reorder tolerance (number of packets to receive after loss to send lossreport)
  SRTO_RCVLATENCY,          // TsbPd receiver delay (mSec) to absorb burst of missed packet retransmission
  SRTO_PEERLATENCY,         // Minimum value of the TsbPd receiver delay (mSec) for the opposite side (peer)
  SRTO_MINVERSION,          // Minimum SRT version needed for the peer (peers with less version will get connection reject)
  SRTO_STREAMID,            // A string set to a socket and passed to the listener's accepted socket
  SRTO_CONGESTION,          // Congestion controller type selection
  SRTO_MESSAGEAPI,          // In File mode, use message API (portions of data with boundaries)
  SRTO_PAYLOADSIZE,         // Maximum payload size sent in one UDP packet (0 if unlimited)
  SRTO_TRANSTYPE = 50,      // Transmission type (set of options required for given transmission type)
  SRTO_KMREFRESHRATE,       // After sending how many packets the encryption key should be flipped to the new key
  SRTO_KMPREANNOUNCE,       // How many packets before key flip the new key is annnounced and after key flip the old one decommissioned
  SRTO_ENFORCEDENCRYPTION,  // Connection to be rejected or quickly broken when one side encryption set or bad password
  SRTO_IPV6ONLY,            // IPV6_V6ONLY mode
  SRTO_PEERIDLETIMEO,       // Peer-idle timeout (max time of silence heard from peer) in [ms]
  SRTO_BINDTODEVICE,        // Forward the SOL_SOCKET/SO_BINDTODEVICE option on socket (pass packets only from that device)
  // see https://github.com/Haivision/srt/blob/master/docs/features/bonding-quick-start.md
  //TODO: SRTO_GROUPCONNECT,        // Set on a listener to allow group connection (ENABLE_BONDING)
  //TODO: SRTO_GROUPMINSTABLETIMEO, // Minimum Link Stability timeout (backup mode) in milliseconds (ENABLE_BONDING)
  //TODO: SRTO_GROUPTYPE,           // Group type to which an accepted socket is about to be added, available in the handshake (ENABLE_BONDING)
  SRTO_PACKETFILTER = 60,   // Add and configure a packet filter
  SRTO_RETRANSMITALGO = 61,  // An option to select packet retransmission algorithm

  SRTO_E_SIZE // Always last element, not a valid option.
}
// from https://github.com/Haivision/srt/blob/master/docs/API/API-socket-options.md#list-of-options
export const SRTSockOptsDetalized = [
  {opt: SRTSockOpt.SRTO_BINDTODEVICE,        restrict: 'pre-bind', type: 'string',  units: '',        default: '',         range: '',         dir: 'RW', entity: 'GSD+'},
  {opt: SRTSockOpt.SRTO_CONGESTION,          restrict: 'pre',      type: 'string',  units: '',        default: 'live',     range: '*',        dir: 'W',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_CONNTIMEO,           restrict: 'pre',      type: 'int32_t', units: 'ms',      default: 3000,       range: '0..',      dir: 'W',  entity: 'GSD+'},
  {opt: SRTSockOpt.SRTO_DRIFTTRACER,         restrict: 'post',     type: 'bool',    units: '',        default: true,       range: '',         dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_ENFORCEDENCRYPTION,  restrict: 'pre',      type: 'bool',    units: '',        default: true,       range: '',         dir: 'W',  entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_EVENT,               restrict: '',         type: 'int32_t', units: 'flags',   default: '',         range: '',         dir: 'R',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_FC,                  restrict: 'pre',      type: 'int32_t', units: 'pkts',    default: 25600,      range: '32..',     dir: 'RW', entity: 'GSD'},
  //TODO: {opt: SRTSockOpt.SRTO_GROUPCONNECT,        restrict: 'pre',      type: 'int32_t', units: '',        default: 0,          range: '0...1',    dir: 'W',  entity: 'S'},
  //TODO: {opt: SRTSockOpt.SRTO_GROUPMINSTABLETIMEO, restrict: 'pre',      type: 'int32_t', units: 'ms',      default: 60,         range: '60-...',   dir: 'W',  entity: 'GDI+'},
  //TODO: {opt: SRTSockOpt.SRTO_GROUPTYPE,           restrict: '',         type: 'int32_t', units: 'enum',    default: '',         range: '',         dir: 'R',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_INPUTBW,             restrict: 'post',     type: 'int64_t', units: 'B/s',     default: 0,          range: '0..',      dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_IPTOS,               restrict: 'pre-bind', type: 'int32_t', units: '',        default: '(system)', range: '0..255',   dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_IPTTL,               restrict: 'pre-bind', type: 'int32_t', units: 'hops',    default: '(system)', range: '1..255',   dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_IPV6ONLY,            restrict: 'pre-bind', type: 'int32_t', units: '',        default: '(system)', range: '-1..1',    dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_ISN,                 restrict: '',         type: 'int32_t', units: '',        default: '',         range: '',         dir: 'R',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_KMPREANNOUNCE,       restrict: 'pre',      type: 'int32_t', units: 'pkts',    default: '2**12',    range: '0.. *',    dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_KMREFRESHRATE,       restrict: 'pre',      type: 'int32_t', units: 'pkts',    default: '2**24',    range: '0..',      dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_KMSTATE,             restrict: '',         type: 'int32_t', units: 'enum',    default: '',         range: '',         dir: 'R',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_LATENCY,             restrict: 'pre',      type: 'int32_t', units: 'ms',      default: '120 *',    range: '0..',      dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_LINGER,              restrict: 'post',     type: 'linger',  units: 's',       default: 'off *',    range: '0..',      dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_LOSSMAXTTL,          restrict: 'post',     type: 'int32_t', units: 'packets', default: 0,          range: '0..',      dir: 'RW', entity: 'GSD+'},
  {opt: SRTSockOpt.SRTO_MAXBW,               restrict: 'post',     type: 'int64_t', units: 'B/s',     default: -1,         range: '-1..',     dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_MESSAGEAPI,          restrict: 'pre',      type: 'bool',    units: '',        default: true,       range: '',         dir: 'W',  entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_MININPUTBW,          restrict: 'post',     type: 'int64_t', units: 'B/s',     default: 0,          range: '0..',      dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_MINVERSION,          restrict: 'pre',      type: 'int32_t', units: 'version', default: 0x010000,   range: '*',        dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_MSS,                 restrict: 'pre-bind', type: 'int32_t', units: 'bytes',   default: 1500,       range: '76..',     dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_NAKREPORT,           restrict: 'pre',      type: 'bool',    units: '',        default: ' *',       range: '',         dir: 'RW', entity: 'GSD+'},
  {opt: SRTSockOpt.SRTO_OHEADBW,             restrict: 'post',     type: 'int32_t', units: '%',       default: 25,         range: '5..100',   dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_PACKETFILTER,        restrict: 'pre',      type: 'string',  units: '',        default: "",         range: '[512]',    dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_PASSPHRASE,          restrict: 'pre',      type: 'string',  units: '',        default: "",         range: '[10..79]', dir: 'W',  entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_PAYLOADSIZE,         restrict: 'pre',      type: 'int32_t', units: 'bytes',   default: '*',        range: '0.. *',    dir: 'W',  entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_PBKEYLEN,            restrict: 'pre',      type: 'int32_t', units: 'bytes',   default: 0,          range: '*',        dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_PEERIDLETIMEO,       restrict: 'pre',      type: 'int32_t', units: 'ms',      default: 5000,       range: '0..',      dir: 'RW', entity: 'GSD+'},
  {opt: SRTSockOpt.SRTO_PEERLATENCY,         restrict: 'pre',      type: 'int32_t', units: 'ms',      default: 0,          range: '0..',      dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_PEERVERSION,         restrict: '',         type: 'int32_t', units: '*',       default: '',         range: '',         dir: 'R',  entity: 'GS'},
  {opt: SRTSockOpt.SRTO_RCVBUF,              restrict: 'pre-bind', type: 'int32_t', units: 'bytes',   default: 8192,       range: '*',        dir: 'RW', entity: 'GSD+'},
  {opt: SRTSockOpt.SRTO_RCVDATA,             restrict: '',         type: 'int32_t', units: 'pkts',    default: '',         range: '',         dir: 'R',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_RCVKMSTATE,          restrict: '',         type: 'int32_t', units: 'enum',    default: '',         range: '',         dir: 'R',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_RCVLATENCY,          restrict: 'pre',      type: 'int32_t', units: 'msec',    default: '*',        range: '0..',      dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_RCVSYN,              restrict: 'post',     type: 'bool',    units: '',        default: true,       range: '',         dir: 'RW', entity: 'GSI'},
  {opt: SRTSockOpt.SRTO_RCVTIMEO,            restrict: 'post',     type: 'int32_t', units: 'ms',      default: -1,         range: '-1, 0..',  dir: 'RW', entity: 'GSI'},
  {opt: SRTSockOpt.SRTO_RENDEZVOUS,          restrict: 'pre',      type: 'bool',    units: '',        default: false,      range: '',         dir: 'RW', entity: 'S'},
  {opt: SRTSockOpt.SRTO_RETRANSMITALGO,      restrict: 'pre',      type: 'int32_t', units: '',        default: 1,          range: '[0, 1]',   dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_REUSEADDR,           restrict: 'pre-bind', type: 'bool',    units: '',        default: true,       range: '',         dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_SENDER,              restrict: 'pre',      type: 'bool',    units: '',        default: false,      range: '',         dir: 'W',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_SNDBUF,              restrict: 'pre-bind', type: 'int32_t', units: 'bytes',   default: 8192,       range: '*',        dir: 'RW', entity: 'GSD+'},
  {opt: SRTSockOpt.SRTO_SNDDATA,             restrict: '',         type: 'int32_t', units: 'pkts',    default: '',         range: '',         dir: 'R',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_SNDDROPDELAY,        restrict: 'post',     type: 'int32_t', units: 'ms',      default: '*',        range: '-1..',     dir: 'W',  entity: 'GSD+'},
  {opt: SRTSockOpt.SRTO_SNDKMSTATE,          restrict: '',         type: 'int32_t', units: 'enum',    default: '',         range: '',         dir: 'R',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_SNDSYN,              restrict: 'post',     type: 'bool',    units: '',        default: true,       range: '',         dir: 'RW', entity: 'GSI'},
  {opt: SRTSockOpt.SRTO_SNDTIMEO,            restrict: 'post',     type: 'int32_t', units: 'ms',      default: -1,         range: '-1..',     dir: 'RW', entity: 'GSI'},
  {opt: SRTSockOpt.SRTO_STATE,               restrict: '',         type: 'int32_t', units: 'enum',    default: '',         range: '',         dir: 'R',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_STREAMID,            restrict: 'pre',      type: 'string',  units: '',        default: "",         range: '[512]',    dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_TLPKTDROP,           restrict: 'pre',      type: 'bool',    units: '',        default: '*' ,       range: '',         dir: 'RW', entity: 'GSD'},
  {opt: SRTSockOpt.SRTO_TRANSTYPE,           restrict: 'pre',      type: 'int32_t', units: 'enum',    default: 'TT_LIVE',  range: '*',        dir: 'W',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_TSBPDMODE,           restrict: 'pre',      type: 'bool',    units: '',        default: '*',        range: '',         dir: 'W',  entity: 'S'},
  {opt: SRTSockOpt.SRTO_UDP_RCVBUF,          restrict: 'pre-bind', type: 'int32_t', units: 'bytes',   default: 8192,       range: '*',        dir: 'RW', entity: 'GSD+'},
  {opt: SRTSockOpt.SRTO_UDP_SNDBUF,          restrict: 'pre-bind', type: 'int32_t', units: 'bytes',   default: 65536,      range: '*',        dir: 'RW', entity: 'GSD+'},
  {opt: SRTSockOpt.SRTO_VERSION,             restrict: '',         type: 'int32_t', units: '',        default: '',         range: '',         dir: 'R',  entity: 'S'},
] as const;
export type SRTSockOptDetalizedR        = StrictExtract<typeof SRTSockOptsDetalized[number], {dir: 'R'}|{dir: 'RW'}>
export type SRTSockOptDetalizedRNumber  = StrictExtract<SRTSockOptDetalizedR, {type: 'int32_t'}|{type: 'int64_t'}>
export type SRTSockOptDetalizedRBoolean = StrictExtract<SRTSockOptDetalizedR, {type: 'bool'}>
export type SRTSockOptDetalizedRString  = StrictExtract<SRTSockOptDetalizedR, {type: 'string'}>
export type SRTSockOptDetalizedW        = StrictExtract<typeof SRTSockOptsDetalized[number], {dir: 'W'}|{dir: 'RW'}>
export type SRTSockOptDetalizedWNumber  = StrictExtract<SRTSockOptDetalizedW, {type: 'int32_t'}|{type: 'int64_t'}>
export type SRTSockOptDetalizedWBoolean = StrictExtract<SRTSockOptDetalizedW, {type: 'bool'}>
export type SRTSockOptDetalizedWString  = StrictExtract<SRTSockOptDetalizedW, {type: 'string'}>
export enum SRTEpollOpt
{
   SRT_EPOLL_OPT_NONE = 0x0, // fallback
   // this values are defined same as linux epoll.h
   // so that if system values are used by mistake, they should have the same effect
   SRT_EPOLL_IN       = 0x1,
   SRT_EPOLL_OUT      = 0x4,
   SRT_EPOLL_ERR      = 0x8,
   SRT_EPOLL_ET       = 0x80000000 // (2147483648) C: 1u << 31
}

export enum SRTSockStatus {
  SRTS_INIT = 1,
  SRTS_OPENED,
  SRTS_LISTENING,
  SRTS_CONNECTING,
  SRTS_CONNECTED,
  SRTS_BROKEN,
  SRTS_CLOSING,
  SRTS_CLOSED,
  SRTS_NONEXIST
}

export enum SRTResult {
  SRT_ERROR = -1,
  SRT_OK = 0
}

/**
 * Enum values as taken from native SRT logging API declarations
 */
export enum SRTLoggingLevel {
  FATAL = 2,
  // Fatal vs. Error: with Error, you can still continue.
  ERROR = 3,
  // Error vs. Warning: Warning isn't considered a problem for the library.
  WARNING = 4,
  // Warning vs. Note: Note means something unusual, but completely correct behavior.
  NOTE = 5,
  // Note vs. Debug: Debug may occur even multiple times in a millisecond.
  // (Well, worth noting that Error and Warning potentially also can).
  DEBUG = 7
}



