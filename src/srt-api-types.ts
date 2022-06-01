import { SRTResult } from "./srt-api-enums";

export type SRTReadReturn = Uint8Array | null | SRTResult.SRT_ERROR;

export type SRTFileDescriptor = number;

export type SRTSockOptValue = boolean | number | string;

export interface SRTEpollResult {
  socket: SRTFileDescriptor
  events: number
}

export interface SRTStats {
  // global measurements
  msTimeStamp: number
  pktSentTotal: number
  pktRecvTotal: number
  pktSndLossTotal: number
  pktRcvLossTotal: number
  pktRetransTotal: number
  pktSentACKTotal: number
  pktRecvACKTotal: number
  pktSentNAKTotal: number
  pktRecvNAKTotal: number
  pktSndDropTotal: number
  pktRcvDropTotal: number
  pktRcvUndecryptTotal: number
  byteSentTotal: number
  byteRecvTotal: number
  byteRcvLossTotal: number
  byteRetransTotal: number
  byteSndDropTotal: number
  byteRcvDropTotal: number
  byteRcvUndecryptTotal: number

  // local measurements
  pktSent: number
  pktRecv: number
  pktSndLoss: number
  pktRcvLoss: number
  pktRetrans: number
  pktRcvRetrans: number
  pktSentACK: number
  pktRecvACK: number
  pktSentNAK: number
  pktRecvNAK: number
  mbpsSendRate: number
  mbpsRecvRate: number
  usSndDuration: number
  pktReorderDistance: number
  pktRcvAvgBelatedTime: number
  pktRcvBelated: number
  pktSndDrop: number
  pktRcvDrop: number
  pktRcvUndecrypt: number
  byteSent: number
  byteRecv: number
  byteRcvLoss: number
  byteRetrans: number
  byteSndDrop: number
  byteRcvDrop: number
  byteRcvUndecrypt: number

  // instant measurements
  usPktSndPeriod: number
  pktFlowWindow: number
  pktCongestionWindow: number
  pktFlightSize: number
  msRTT: number
  mbpsBandwidth: number
  byteAvailSndBuf: number
  byteAvailRcvBuf: number
  mbpsMaxBW: number
  byteMSS: number
  pktSndBuf: number
  byteSndBuf: number
  msSndBuf: number
  msSndTsbPdDelay: number
  pktRcvBuf: number
  byteRcvBuf: number
  msRcvBuf: number
  msRcvTsbPdDelay: number
  pktSndFilterExtraTotal: number
  pktRcvFilterExtraTotal: number
  pktRcvFilterSupplyTotal: number
  pktRcvFilterLossTotal: number
  pktSndFilterExtra: number
  pktRcvFilterExtra: number
  pktRcvFilterSupply: number
  pktRcvFilterLoss: number
  pktReorderTolerance: number

  // Total
  pktSentUniqueTotal: number
  pktRecvUniqueTotal: number
  byteSentUniqueTotal: number
  byteRecvUniqueTotal: number

  // Local
  pktSentUnique: number
  pktRecvUnique: number
  byteSentUnique: number
  byteRecvUnique: number
}
