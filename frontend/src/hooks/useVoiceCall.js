import { useState, useRef, useEffect } from 'react';

export default function useVoiceCall({ socket, userId, otherUserId, otherUser, onCallEnd }) {
  const [callState, setCallState] = useState('idle'); // idle, calling, ringing, connected, ended
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callTimerRef = useRef(null);
  const callStartTimeRef = useRef(null);

  // WebRTC configuration with better STUN/TURN servers for production
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };

  // Start call timer
  const startCallTimer = () => {
    setCallDuration(0);
    callStartTimeRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Stop call timer
  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Initialize peer connection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(rtcConfig);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call.ice-candidate', {
          receiverId: otherUserId,
          candidate: event.candidate
        });
      }
    };
    
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        startCallTimer();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
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
      
      console.log('Requesting microphone access...');
      
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
      
      console.log('Microphone access granted');
      localStreamRef.current = stream;
      
      // Create peer connection
      const pc = createPeerConnection();
      
      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Send offer to the other user via socket
      socket.emit('call.offer', {
        receiverId: otherUserId,
        offer: offer
      });
      
    } catch (error) {
      console.error('Error starting call:', error);
      
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
      
      console.log('Answering call, requesting microphone...');
      
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
      
      console.log('Microphone access granted for answer');
      localStreamRef.current = stream;
      
      // Create peer connection
      const pc = createPeerConnection();
      
      // Add local stream tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Set remote description from the offer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      
      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Send answer back via socket
      socket.emit('call.answer', {
        receiverId: incomingCall.callerId,
        answer: answer
      });
      
      setIncomingCall(null);
      
    } catch (error) {
      console.error('Error answering call:', error);
      
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
      setIncomingCall(null);
    }
    setCallState('idle');
  };

  // End call
  const endCall = () => {
    const hadActiveCall = callState === 'connected';
    const finalDuration = callDuration;
    
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop timer
    stopCallTimer();
    
    // Notify other user
    if (callState !== 'idle' && socket && otherUserId) {
      socket.emit('call.end', {
        receiverId: otherUserId
      });
    }
    
    // Create call log if call was connected
    if (hadActiveCall && finalDuration > 0 && onCallEnd) {
      onCallEnd(finalDuration);
    }
    
    setCallState('idle');
    setCallDuration(0);
    callStartTimeRef.current = null;
  };

  // Handle incoming call signals
  useEffect(() => {
    if (!socket) return;
    
    const handleCallOffer = async (data) => {
      setIncomingCall({
        callerId: data.senderId,
        callerName: data.callerName || 'User',
        offer: data.offer
      });
      setCallState('ringing');
    };
    
    const handleCallAnswer = async (data) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };
    
    const handleIceCandidate = async (data) => {
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };
    
    const handleCallReject = () => {
      setCallState('idle');
      endCall();
      alert('Call was rejected');
    };
    
    const handleCallEnd = () => {
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
