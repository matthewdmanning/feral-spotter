import React, { Component, type ReactNode } from 'react'
import { View, Text, Pressable } from 'react-native'
import { AlertCircle } from 'lucide-react-native'
import { styles } from './ErrorBoundary.styles'

interface Props { children: ReactNode; fallback?: (error: Error, reset: () => void) => ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('ErrorBoundary:', error, info) }
  handleReset = () => this.setState({ hasError: false, error: null })
  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.handleReset)
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />
    }
    return this.props.children
  }
}

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <View style={styles.container}>
      <AlertCircle size={64} color="#FF6B6B" />
      <View style={styles.textGroup}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>An unexpected error occurred. Please try again.</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.cardInner}>
          <Text style={styles.errorLabel}>Error Details:</Text>
          <View style={styles.errorBox}><Text style={styles.errorText}>{error.message}</Text></View>
        </View>
      </View>
      <Pressable onPress={onReset} style={styles.btn} accessibilityRole="button">
        <Text style={styles.btnText}>Try Again</Text>
      </Pressable>
    </View>
  )
}

