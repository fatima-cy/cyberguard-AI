// Resource Lock Deploy Module (Resource Group scoped)
param lockName string = 'PreventDeletion'
param notes string = 'Prevent accidental deletion of production resources'

resource lock 'Microsoft.Authorization/locks@2020-05-01' = {
  name: lockName
  properties: {
    level: 'CanNotDelete'
    notes: notes
  }
}
