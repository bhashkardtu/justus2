import { useState, useRef, useEffect } from 'react';
import { getWebRTCConfig } from '../services/config';

export default function useVoiceCall({ socket, userId, otherUserId, otherUser, onCallEnd }) {
  const [callState, setCallState] = useState('idle'); // idle, calling, ringing, connected, ended
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callTimerRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const rtcConfigRef = useRef(null);

  // Fetch WebRTC config from backend on mount
  useEffect(() => {
    const fetchConfig = async () => {
      const config = await getWebRTCConfig();
      rtcConfigRef.current = config;
      console.log('[voice] WebRTC config loaded from backend');
    };
    fetchConfig();
  }, []);


  // Start call timer
  const startCallTimer = () => {
    console.log('[voice] startCallTimer');
    setCallDuration(0);
    callStartTimeRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => {
        const next = prev + 1;
        if (next % 5 === 0) console.log('[voice] callDuration', next);
        return next;
      });
    }, 1000);
  };

  // Stop call timer
  const stopCallTimer = () => {
    console.log('[voice] stopCallTimer');
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Initialize peer connection
  const createPeerConnection = () => {
    const config = rtcConfigRef.current;
    if (!config) {
      console.error('[voice] WebRTC config not loaded yet');
      return null;
    }
    
    console.log('[voice] createPeerConnection with config from backend');
    const pc = new RTCPeerConnection(config);
    
    pc.onicecandidate = (event) => {
      console.log('[voice] onicecandidate event:', event);
      if (event.candidate) {
        console.log('[voice] local ICE candidate:', event.candidate.candidate);
        if (event.candidate.candidate && event.candidate.candidate.includes(' typ relay')) {
          console.log('[voice] RELAY candidate generated locally');
        }
      }
      if (event.candidate && socket) {
        socket.emit('call.ice-candidate', {
          receiverId: otherUserId,
          candidate: event.candidate
        });
        console.log('[voice] emitted call.ice-candidate to', otherUserId);
      }
    };
    
    pc.onicecandidateerror = (err) => {
      console.error('[voice] onicecandidateerror', err);
    };

    pc.ontrack = (event) => {
      console.log('[voice] ontrack event, streams present:', !!(event.streams && event.streams[0]));
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        console.log('[voice] remoteStreamRef set, audio tracks:', remoteStreamRef.current.getAudioTracks().length);
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log('[voice] connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        startCallTimer();
        console.log('[voice] Peer connection is connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.warn('[voice] Peer connection disconnected/failed:', pc.connectionState);
        endCall();
      } else {
        console.log('[voice] connectionState changed to', pc.connectionState);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('[voice] iceGatheringState:', pc.iceGatheringState);
    };

    pc.onsignalingstatechange = () => {
      console.log('[voice] signalingState:', pc.signalingState);
    };
    
    peerConnectionRef.current = pc;
    return pc;
  };

  // Start a call
  const startCall = async () => {
    if (!socket || !otherUserId) {
      alert('Cannot start call: not connected');
      return;
    }

    try {
      setCallState('calling');
      
      console.log('[voice] Requesting microphone access...');
      
      // Check if HTTPS (required for getUserMedia in production)
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        alert('Voice calls require HTTPS connection. Please use a secure connection.');
        setCallState('idle');
        return;
      }
      
      // Get user media with error handling
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }, 
        video: false 
      });
      
      console.log('[voice] Microphone access granted, tracks:', stream.getTracks().map(t => t.kind));
      localStreamRef.current = stream;
      
      // Create peer connection
      const pc = createPeerConnection();
      
      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('[voice] added local audio track', track);
      });
      
      // Create offer
      const offer = await pc.createOffer();
      console.log('[voice] created offer');
      await pc.setLocalDescription(offer);
      console.log('[voice] setLocalDescription done');
      
      // Send offer to the other user via socket
      socket.emit('call.offer', {
        receiverId: otherUserId,
        offer: offer
      });
      console.log('[voice] emitted call.offer to', otherUserId);
      
    } catch (error) {
      console.error('[voice] Error starting call:', error);
      
      let errorMessage = 'Failed to start call. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Microphone access denied. Please allow microphone permissions.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Microphone is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Unable to satisfy audio constraints.';
      } else if (error.name === 'SecurityError') {
        errorMessage += 'Voice calls require HTTPS in production.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      alert(errorMessage);
      setCallState('idle');
    }
  };

  // Answer incoming call
  const answerCall = async () => {
    if (!incomingCall || !socket) return;
    
    try {
      setCallState('connected');
      
      console.log('[voice] Answering call, requesting microphone...');
      
      // Check if HTTPS
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        alert('Voice calls require HTTPS connection.');
        rejectCall();
        return;
      }
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }, 
        video: false 
      });
      
      console.log('[voice] Microphone access granted for answer');
      localStreamRef.current = stream;
      
      // Create peer connection
      const pc = createPeerConnection();
      
      // Add local stream tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('[voice] added local audio track for answer');
      });
      
      // Set remote description from the offer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      console.log('[voice] setRemoteDescription(offer) done');
      
      // Flush queued ICE candidates after peer connection is ready
      if (pendingCandidates.current.length > 0) {
        console.log(`[voice] Adding ${pendingCandidates.current.length} queued ICE candidates`);
        for (const candidate of pendingCandidates.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidates.current = [];
      }


      // Create answer
      const answer = await pc.createAnswer();
      console.log('[voice] created answer');
      await pc.setLocalDescription(answer);
      console.log('[voice] setLocalDescription(answer) done');
      
      // Send answer back via socket
      socket.emit('call.answer', {
        receiverId: incomingCall.callerId,
        answer: answer
      });
      console.log('[voice] emitted call.answer to', incomingCall.callerId);
      
      setIncomingCall(null);
      
    } catch (error) {
      console.error('[voice] Error answering call:', error);
      
      let errorMessage = 'Failed to answer call. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Microphone access denied.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found.';
      } else if (error.name === 'SecurityError') {
        errorMessage += 'Voice calls require HTTPS.';
      } else {
        errorMessage += error.message || 'Unknown error.';
      }
      
      alert(errorMessage);
      rejectCall();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    if (incomingCall && socket) {
      socket.emit('call.reject', {
        receiverId: incomingCall.callerId
      });
      console.log('[voice] emitted reject to', incomingCall.callerId);
      setIncomingCall(null);
    }
    setCallState('idle');
  };

  // End call
  const endCall = () => {
    console.log('[voice] endCall called, callState=', callState);
    const hadActiveCall = callState === 'connected';
    const finalDuration = callDuration;
    
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[voice] stopped local track', track.kind);
      });
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
        console.log('[voice] peerConnection closed');
      } catch (e) {
        console.error('[voice] error closing peerConnection', e);
      }
      peerConnectionRef.current = null;
    }
    
    // Stop timer
    stopCallTimer();
    
    // Notify other user
    if (callState !== 'idle' && socket && otherUserId) {
      socket.emit('call.end', {
        receiverId: otherUserId
      });
      console.log('[voice] emitted call.end to', otherUserId);
    }
    
    // Create call log if call was connected
    if (hadActiveCall && finalDuration > 0 && onCallEnd) {
      onCallEnd(finalDuration);
      console.log('[voice] onCallEnd fired', finalDuration);
    }
    
    setCallState('idle');
    setCallDuration(0);
    callStartTimeRef.current = null;
  };

  // Handle incoming call signals
  const pendingCandidates = useRef([]);

  useEffect(() => {
    if (!socket) return;
    
    const handleCallOffer = async (data) => {
      console.log('[voice] received call.offer from', data.senderId);
      setIncomingCall({
        callerId: data.senderId,
        callerName: data.callerName || 'User',
        offer: data.offer
      });
      setCallState('ringing');
    };
    
    const handleCallAnswer = async (data) => {
      console.log('[voice] received call.answer from', data.senderId);
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('[voice] setRemoteDescription(answer) success');
        } else {
          console.warn('[voice] no peerConnection to set remote answer on');
        }
      } catch (err) {
        console.error('[voice] error setting remote answer', err);
      }
    };
    
    const handleIceCandidate = async (data) => {
  console.log('[voice] received remote ICE candidate from socket', data);
  try {
    if (peerConnectionRef.current && data.candidate) {
      if (data.candidate.candidate && data.candidate.candidate.includes(' typ relay')) {
        console.log('[voice] REMOTE relay candidate received');
      }
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      console.log('[voice] addIceCandidate success');
    } else {
      // No peer connection yet — queue it for later
      console.warn('[voice] No peerConnection yet, queueing candidate');
      pendingCandidates.current.push(data.candidate);
    }
  } catch (err) {
    console.error('[voice] addIceCandidate error', err);
  }
};

    
    const handleCallReject = () => {
      console.log('[voice] received call.reject');
      setCallState('idle');
      endCall();
      alert('Call was rejected');
    };
    
    const handleCallEnd = () => {
      console.log('[voice] received call.end');
      endCall();
    };
    
    socket.on('call.offer', handleCallOffer);
    socket.on('call.answer', handleCallAnswer);
    socket.on('call.ice-candidate', handleIceCandidate);
    socket.on('call.reject', handleCallReject);
    socket.on('call.end', handleCallEnd);
    
    return () => {
      socket.off('call.offer', handleCallOffer);
      socket.off('call.answer', handleCallAnswer);
      socket.off('call.ice-candidate', handleIceCandidate);
      socket.off('call.reject', handleCallReject);
      socket.off('call.end', handleCallEnd);
    };
  }, [socket, otherUserId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return {
    callState,
    incomingCall,
    callDuration,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    localStreamRef,
    remoteStreamRef
  };
}
